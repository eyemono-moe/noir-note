import { eq, useLiveQuery } from "@tanstack/solid-db";
import { Show, Suspense, lazy, type Component } from "solid-js";

import { useMemosCollection } from "../../context/db";

const MarkdownRenderer = lazy(() => import("../Preview/MarkdownRenderer"));

const MemoPreview: Component<{ path: string }> = (props) => {
  const collection = useMemosCollection();

  const memoQuery = useLiveQuery((q) => {
    const path = props.path;
    return q
      .from({ memos: collection })
      .where(({ memos }) => eq(memos.path, path))
      .select(({ memos }) => ({ content: memos.content }));
  });

  return (
    <div class="max-h-96 w-72 overflow-y-auto">
      <Show
        when={memoQuery.isReady}
        fallback={<div class="text-text-secondary p-4 text-sm">Loading...</div>}
      >
        <Show
          when={memoQuery()?.[0]?.content}
          fallback={<div class="text-text-secondary p-4 text-sm">No content yet</div>}
        >
          {(content) => (
            <Suspense fallback={<div class="text-text-secondary p-4 text-sm">Rendering...</div>}>
              <MarkdownRenderer content={content()} />
            </Suspense>
          )}
        </Show>
      </Show>
    </div>
  );
};

export default MemoPreview;
