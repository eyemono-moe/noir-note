import { type Component, Show, lazy } from "solid-js";

import type { MemoFrontmatter } from "../../types/memo";
import type { PreviewScrollAdapter } from "../../types/scrollSync";

const MarkdownRenderer = lazy(() => import("./MarkdownRenderer"));
const SlideRenderer = lazy(() => import("./SlideRenderer"));

interface PreviewProps {
  content: string;
  metadata?: MemoFrontmatter;
  /** Called when a task list checkbox is clicked (Markdown mode only). */
  onCheckboxToggle?: (offset: number, checked: boolean) => void;
  /** Called with the scroll adapter once the renderer is ready (null on unmount). */
  onAdapterReady?: (adapter: PreviewScrollAdapter | null) => void;
}

/**
 * Unified preview component that delegates to `SlideRenderer` when
 * `metadata.marp === true`, and to `MarkdownRenderer` otherwise.
 *
 * Both renderers expose the same `onAdapterReady` callback so callers never
 * need to know which renderer is active.
 */
const Preview: Component<PreviewProps> = (props) => {
  return (
    <Show
      when={props.metadata?.marp === true}
      fallback={
        <MarkdownRenderer
          content={props.content}
          onCheckboxToggle={props.onCheckboxToggle}
          onAdapterReady={props.onAdapterReady}
        />
      }
    >
      <SlideRenderer content={props.content} onAdapterReady={props.onAdapterReady} />
    </Show>
  );
};

export default Preview;
