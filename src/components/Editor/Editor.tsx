import { EditorState, Transaction } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { createCodeMirror } from "solid-codemirror";
import { createEffect, type Component } from "solid-js";

import { EditorStateLRUCache } from "../../context/editorStateCache";
import { useTheme } from "../../context/theme";
import { createEditorExtensions } from "../../editor/extensions";

interface EditorProps {
  /** Current memo path. When this changes, the editor state is saved and potentially restored from cache. */
  path: string;
  /** Current memo content. Used to control editor document and detect stale cache. */
  content: string;
  /** Called whenever user makes manual edits to the editor. */
  onChange: (content: string) => void;
  placeholder?: string;
  /** For scroll sync and other integrations: called when EditorView is ready. */
  onEditorView?: (view: EditorView | undefined) => void;
}

/**
 * Editor component with built-in EditorState cache per memo path.
 * - Saves current memo's EditorState when `path` prop changes
 * - Attempts to restore from cache on path transitions
 * - Detects stale cache by comparing document hash
 * - Falls back to fresh EditorState (clearing history) when cache is unavailable/stale
 *
 * Depends only on: path, content, global theme config, scroll sync refs (external)
 */
const Editor: Component<EditorProps> = (props) => {
  const isDark = useTheme();

  // Editor-owned LRU cache for EditorState
  const stateCache = new EditorStateLRUCache({ maxSize: 8 });

  const { ref, editorView, createExtension } = createCodeMirror({
    onValueChange: (value) => props.onChange(value),
  });

  // Setup extensions with theme
  createExtension(() => createEditorExtensions(isDark()));

  // Single effect that handles: save on path change, then restore or sync document.
  //
  // `useLiveQuery` (TanStack DB) delivers content asynchronously via createResource, so
  // when the path prop changes the content prop may still hold the previous path's value
  // on the first firing.  We carry a `justChangedPath` flag in `prev` so that the
  // follow-up firing — where pathChanged is now false but the content finally caught up
  // to the new path — is still treated as a path transition rather than an external edit.
  createEffect<{ path?: string; content?: string; justChangedPath?: boolean }>((prev) => {
    const view = editorView();
    const newPath = props.path;
    const newContent = props.content;

    if (!view) {
      return { path: newPath, content: newContent, justChangedPath: false };
    }

    const prevPath = prev?.path as string | undefined;
    const pathChanged = !!prev && prevPath !== newPath;
    // True when this firing is a path transition itself OR a deferred follow-up
    // caused by useLiveQuery's async content delivery.
    const isPathTransition = pathChanged || (prev?.justChangedPath ?? false);

    // 1) If path changed, save previous EditorState synchronously
    if (pathChanged && prevPath) {
      stateCache.save(prevPath, view.state);
    }

    // 2) Keep editor document in sync with incoming content
    const localValue = view.state.doc.toString();
    if (localValue !== newContent) {
      if (isPathTransition) {
        // Path transition (or async follow-up): restore full EditorState from cache
        const restored = stateCache.load(newPath, newContent);
        if (restored) {
          view.setState(restored);
        } else {
          // no valid cache -> clear history by creating a fresh state
          view.setState(
            EditorState.create({
              doc: newContent,
              extensions: createEditorExtensions(isDark()),
            }),
          );
        }
        // Transition handled — clear the flag
        return { path: newPath, content: newContent, justChangedPath: false };
      } else {
        // same path: external update (e.g., other tab or DB sync)
        // apply changes without adding to undo history
        view.dispatch({
          changes: { from: 0, to: localValue.length, insert: newContent },
          annotations: Transaction.addToHistory.of(false),
        });
      }
    }

    // If we were in a path transition but content was still stale (localValue === newContent),
    // keep the flag so the next firing (when content finally delivers) is handled correctly.
    return {
      path: newPath,
      content: newContent,
      justChangedPath: isPathTransition && localValue === newContent,
    };
  });

  // Notify parent whenever the EditorView instance changes
  createEffect(() => {
    props.onEditorView?.(editorView());
  });

  return (
    <div class="h-full w-full">
      <div ref={ref} class="h-full" />
    </div>
  );
};

export default Editor;
