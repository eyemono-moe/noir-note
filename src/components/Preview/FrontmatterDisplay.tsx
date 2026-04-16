import { JsonTreeView } from "@ark-ui/solid";
import { For, type Component, Show } from "solid-js";

import type { MemoFrontmatter } from "../../types/memo";

import styles from "./jsonTreeView.module.css";

interface FrontmatterDisplayProps {
  metadata: MemoFrontmatter;
}

const FrontmatterDisplay: Component<FrontmatterDisplayProps> = (props) => {
  return (
    <div class="mb-6 border-b border-gray-200 pb-6">
      {/* Title Display */}
      <Show when={props.metadata.title}>
        <h1 class="mb-4 text-3xl font-bold text-gray-900">{props.metadata.title}</h1>
      </Show>

      {/* Tags Display */}
      <Show when={props.metadata.tags && props.metadata.tags.length > 0}>
        <div class="mb-4 flex flex-wrap gap-2">
          {
            <For each={props.metadata.tags}>
              {(tag) => (
                <span class="rounded-full bg-blue-100 px-2 py-0.5 text-sm font-medium text-blue-800">
                  {tag}
                </span>
              )}
            </For>
          }
        </div>
      </Show>

      {/* Full Metadata as JSON Tree */}
      <details class="cursor-pointer">
        <summary class="mb-2 text-sm font-medium text-gray-600 hover:text-gray-900">
          View Full Metadata
        </summary>
        <div class="rounded border border-gray-200 bg-gray-50 p-2">
          <JsonTreeView.Root defaultExpandedDepth={1} class={styles.Root} data={props.metadata}>
            <JsonTreeView.Tree
              class={styles.Tree}
              arrow={<span class="i-material-symbols-chevron-right size-3 text-gray-500" />}
            />
          </JsonTreeView.Root>
        </div>
      </details>
    </div>
  );
};

export default FrontmatterDisplay;
