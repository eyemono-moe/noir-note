import rehypeExternalLinks from "rehype-external-links";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { type Component, createMemo, createResource, Show } from "solid-js";
import { unified } from "unified";

import "../../styles/markdown.css";
import { parseFrontmatter } from "../../utils/frontmatter";
import FrontmatterDisplay from "./FrontmatterDisplay";

interface MarkdownPreviewProps {
  content: string;
}

const MarkdownPreview: Component<MarkdownPreviewProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;

  const parser = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeExternalLinks, { target: "_blank", rel: ["noopener", "noreferrer"] })
    .use(rehypeStringify);

  // Parse frontmatter and separate content
  const parsed = createMemo(() => parseFrontmatter(props.content));
  const metadata = createMemo(() => parsed().metadata);
  const contentWithoutFrontmatter = createMemo(() => parsed().contentWithoutFrontmatter);

  // Render markdown (without frontmatter)
  const [html] = createResource(contentWithoutFrontmatter, async (content) => {
    try {
      const file = await parser.process(content);
      return file.value as string;
    } catch (error) {
      console.error("Failed to parse markdown:", error);
      return "<p>Error parsing markdown</p>";
    }
  });

  return (
    <div class="markdown-body h-full w-full overflow-auto p-4">
      {/* Frontmatter Display */}
      <Show when={metadata()}>{(data) => <FrontmatterDisplay metadata={data()} />}</Show>

      {/* Markdown Content */}
      {/* oxlint-disable solid/no-innerhtml: needed for markdown rendering */}
      <div ref={containerRef} innerHTML={html()} />
    </div>
  );
};

export default MarkdownPreview;
