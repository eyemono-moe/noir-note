import { marked } from "marked";
import { type Component, createMemo } from "solid-js";

interface MarkdownPreviewProps {
  content: string;
}

// Configure marked for security and simplicity
marked.setOptions({
  breaks: true,
  gfm: true,
});

const MarkdownPreview: Component<MarkdownPreviewProps> = (props) => {
  const html = createMemo(() => {
    try {
      return marked.parse(props.content) as string;
    } catch (error) {
      console.error("Failed to parse markdown:", error);
      return "<p>Error parsing markdown</p>";
    }
  });

  return (
    <div class="h-full w-full overflow-auto">
      {/* oxlint-disable solid/no-innerhtml: needed for markdown rendering */}
      <div class="markdown-preview p-4" innerHTML={html()} />
    </div>
  );
};

export default MarkdownPreview;
