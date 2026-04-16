import { marked } from "marked";
import { type Component, createEffect, createMemo } from "solid-js";

import "../../styles/markdown.css";

interface MarkdownPreviewProps {
  content: string;
}

// Configure marked for security and simplicity
marked.setOptions({
  breaks: true,
  gfm: true,
});

const MarkdownPreview: Component<MarkdownPreviewProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;

  const html = createMemo(() => {
    try {
      return marked.parse(props.content) as string;
    } catch (error) {
      console.error("Failed to parse markdown:", error);
      return "<p>Error parsing markdown</p>";
    }
  });

  // Add target="_blank" to external links
  createEffect(() => {
    const container = containerRef;
    if (!container) return;

    // Re-process links when HTML changes
    html();

    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href) return;

      // External link: open in new tab
      if (href.startsWith("http://") || href.startsWith("https://")) {
        target.setAttribute("target", "_blank");
        target.setAttribute("rel", "noopener noreferrer");
      }
      // Internal links work normally via router
    };

    container.addEventListener("click", handleClick);
    return () => container.removeEventListener("click", handleClick);
  });

  return (
    <div class="h-full w-full overflow-auto p-4">
      {/* oxlint-disable solid/no-innerhtml: needed for markdown rendering */}
      <div ref={containerRef} class="markdown-preview" innerHTML={html()} />
    </div>
  );
};

export default MarkdownPreview;
