import { type Component, createMemo, createResource, Show } from "solid-js";

import { useTheme } from "../../context/theme";

import marpCss from "../../styles/marp.css?inline";

async function renderWithMarp(content: string) {
  const { Marp } = await import("@marp-team/marp-core");
  const marp = new Marp();
  const { html, css } = marp.render(content);

  return { html, css };
}

interface SlideRendererProps {
  content: string;
}

const SlideRenderer: Component<SlideRendererProps> = (props) => {
  const [marpResult] = createResource(() => props.content, renderWithMarp);
  const isDark = useTheme();

  const iframeContent = createMemo(() => {
    const result = marpResult.latest;
    return `<!DOCTYPE html><html data-theme="${isDark() ? "dark" : "light"}"><head><style>${marpCss + result?.css}</style></head><body>${result?.html}</body></html>`;
  });

  return (
    <div class="bg-surface-primary h-full w-full">
      <Show
        when={iframeContent()}
        fallback={<p class="text-text-secondary text-sm">Rendering slides...</p>}
      >
        {(content) => (
          <iframe srcdoc={content()} sandbox="allow-same-origin" class="h-full w-full border-0" />
        )}
      </Show>
    </div>
  );
};

export default SlideRenderer;
