import { For, type Component, Show } from "solid-js";

import type { MemoFrontmatter } from "../../types/memo";

interface FrontmatterDisplayProps {
  metadata: MemoFrontmatter;
}

const FrontmatterDisplay: Component<FrontmatterDisplayProps> = (props) => {
  return (
    <div class="">
      {/* Title Display */}
      <Show when={props.metadata.title}>
        <h1 class="text-text-primary mb-4 text-3xl font-bold">{props.metadata.title}</h1>
      </Show>

      {/* Tags Display */}
      <Show when={props.metadata.tags && props.metadata.tags.length > 0}>
        <div class="mb-4 flex flex-wrap gap-2">
          {
            <For each={props.metadata.tags}>
              {(tag) => (
                <span class="bg-surface-transparent-accent text-text-accent rounded-full px-2 py-0.5 text-sm font-medium">
                  {tag}
                </span>
              )}
            </For>
          }
        </div>
      </Show>
    </div>
  );
};

export default FrontmatterDisplay;
