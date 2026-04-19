import { Clipboard } from "@ark-ui/solid";
import type { Node, Root, RootContent, RootContentMap } from "mdast";
import mermaid from "mermaid";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import type { Component, JSX } from "solid-js";
import { For, Match, Show, Suspense, Switch, createMemo, createResource } from "solid-js";

import "../../styles/markdown.css";
import "../../styles/shiki.css";
import { unified } from "unified";

import { useTheme } from "../../context/theme";
import { bundledLanguages, codeToHtml } from "../../editor/shiki.bundle";
import { parseFrontmatterYamlString } from "../../utils/frontmatter";
import { remarkFootnoteBackLink } from "../../utils/remark/remark-footnote-back-link";

interface MarkdownRendererProps {
  content: string;
}

/**
 * All possible mdast node types we handle in rendering
 */
type RenderableNode = RootContent;

// ============================================================================
// Node Components
// ============================================================================

const TextNode: Component<{ node: RootContentMap["text"] }> = (props) => {
  return <>{props.node.value}</>;
};

const ParagraphNode: Component<{ node: RootContentMap["paragraph"] }> = (props) => {
  return (
    <p>
      <NodesRenderer nodes={props.node.children} />
    </p>
  );
};

const HeadingNode: Component<{ node: RootContentMap["heading"] }> = (props) => {
  const children = <NodesRenderer nodes={props.node.children} />;
  return (
    <Switch>
      <Match when={props.node.depth === 1}>
        <h1>{children}</h1>
      </Match>
      <Match when={props.node.depth === 2}>
        <h2>{children}</h2>
      </Match>
      <Match when={props.node.depth === 3}>
        <h3>{children}</h3>
      </Match>
      <Match when={props.node.depth === 4}>
        <h4>{children}</h4>
      </Match>
      <Match when={props.node.depth === 5}>
        <h5>{children}</h5>
      </Match>
      <Match when={props.node.depth === 6}>
        <h6>{children}</h6>
      </Match>
    </Switch>
  );
};

const EmphasisNode: Component<{ node: RootContentMap["emphasis"] }> = (props) => {
  return (
    <em>
      <NodesRenderer nodes={props.node.children} />
    </em>
  );
};

const StrongNode: Component<{ node: RootContentMap["strong"] }> = (props) => {
  return (
    <strong>
      <NodesRenderer nodes={props.node.children} />
    </strong>
  );
};

const DeleteNode: Component<{ node: RootContentMap["delete"] }> = (props) => {
  return (
    <del>
      <NodesRenderer nodes={props.node.children} />
    </del>
  );
};

const LinkNode: Component<{ node: RootContentMap["link"] }> = (props) => {
  const isAbsoluteURL = () => /^[a-z][a-z0-9+.-]*:/.test(props.node.url);

  return (
    <a
      href={props.node.url}
      title={props.node.title ?? undefined}
      target={isAbsoluteURL() ? "_blank" : undefined}
      rel={isAbsoluteURL() ? "noopener noreferrer" : undefined}
    >
      <NodesRenderer nodes={props.node.children} />
    </a>
  );
};

const ImageNode: Component<{ node: RootContentMap["image"] }> = (props) => {
  return (
    <img src={props.node.url} alt={props.node.alt ?? ""} title={props.node.title ?? undefined} />
  );
};

const InlineCodeNode: Component<{ node: RootContentMap["inlineCode"] }> = (props) => {
  return <code>{props.node.value}</code>;
};

/**
 * Mermaid diagram renderer component
 */
const MermaidDiagram: Component<{ code: string }> = (props) => {
  const isDark = useTheme();

  const [result] = createResource(
    () => ({ code: props.code, dark: isDark() }),
    async (params) => {
      try {
        const id = `mermaid-${Math.random().toString(36).substring(2, 11)}`;
        mermaid.initialize({
          startOnLoad: false,
          theme: params.dark ? "dark" : "default",
        });

        const { svg } = await mermaid.render(id, params.code);
        return { success: true as const, svg };
      } catch (error) {
        console.error("Mermaid rendering failed:", error);
        return { success: false as const, error: String(error) };
      }
    },
  );

  const currentError = createMemo(() => {
    const current = result();
    return current && !current.success ? current : null;
  });

  return (
    <Show
      when={result.latest?.success}
      fallback={
        <>
          <pre>
            <code>{props.code}</code>
          </pre>
          <Show when={currentError()}>
            {(err) => (
              <div class="text-text-danger text-sm">
                <p>Mermaid rendering error:</p>
                <pre class="text-sm">{err().error}</pre>
              </div>
            )}
          </Show>
        </>
      }
    >
      <div
        class="mermaid-diagram bg-surface-secondary mb-4 flex justify-center rounded-lg p-2"
        // oxlint-disable-next-line solid/no-innerhtml
        innerHTML={result.latest?.svg}
      />
    </Show>
  );
};

/**
 * Syntax highlighted code block renderer component
 */
const SyntaxHighlightedCode: Component<{ code: string; lang?: string | null }> = (props) => {
  const [result] = createResource(
    () => ({ code: props.code, lang: props.lang }),
    async (params) => {
      try {
        const lang = !params.lang
          ? "plaintext"
          : params.lang in bundledLanguages
            ? params.lang
            : "plaintext";

        const html = await codeToHtml(params.code, {
          lang,
          themes: { light: "github-light", dark: "github-dark" },
        });
        return { success: true as const, html };
      } catch (error) {
        console.error("Syntax highlighting failed:", error);
        return { success: false as const };
      }
    },
    {
      initialValue: { success: false as const },
    },
  );

  return (
    <Show
      when={result.latest?.success}
      fallback={
        <pre>
          <code>{props.code}</code>
        </pre>
      }
    >
      {/* oxlint-disable-next-line solid/no-innerhtml */}
      <div innerHTML={result.latest?.html} />
    </Show>
  );
};

/**
 * Code block node with clipboard functionality
 */
const CodeNode: Component<{ node: RootContentMap["code"] }> = (props) => {
  const isMermaid = () => props.node.lang === "mermaid";

  return (
    <div class="parent relative">
      {/* Clipboard button */}
      <Clipboard.Root
        class="parent-hover:block parent-focus-within:block absolute top-2 right-2 hidden"
        value={props.node.value}
      >
        <Clipboard.Trigger class="bg-surface-control-rest not-active:hover:bg-surface-control-hover active:bg-surface-control-active border-border-primary inline-flex items-center justify-center rounded-lg border p-2 text-sm font-medium transition-colors">
          <Clipboard.Indicator
            copied={<span class="i-material-symbols:check-rounded text-text-accent block size-4" />}
          >
            <span class="i-material-symbols:copy-all-outline-rounded text-text-secondary block size-4" />
          </Clipboard.Indicator>
        </Clipboard.Trigger>
      </Clipboard.Root>

      {/* Render based on language */}
      <Switch>
        <Match when={isMermaid()}>
          <Suspense
            fallback={
              <pre>
                <code>{props.node.value}</code>
              </pre>
            }
          >
            <MermaidDiagram code={props.node.value} />
          </Suspense>
        </Match>
        <Match when={!isMermaid()}>
          <SyntaxHighlightedCode code={props.node.value} lang={props.node.lang} />
        </Match>
      </Switch>
    </div>
  );
};

const ListNode: Component<{ node: RootContentMap["list"] }> = (props) => {
  // Determine if the list is "loose" (has spacing between items)
  const loose = () => props.node.spread ?? false;

  return (
    <>
      {props.node.ordered ? (
        <ol start={props.node.start ?? undefined}>
          <For each={props.node.children}>
            {(item) => <ListItemNode node={item} loose={loose()} />}
          </For>
        </ol>
      ) : (
        <ul>
          <For each={props.node.children}>
            {(item) => <ListItemNode node={item} loose={loose()} />}
          </For>
        </ul>
      )}
    </>
  );
};

const ListItemNode: Component<{
  node: RootContentMap["listItem"];
  loose?: boolean;
}> = (props) => {
  /**
   * Render list item children with proper paragraph handling.
   * Based on mdast-util-to-hast logic:
   * - In tight lists (loose=false), unwrap single paragraphs
   * - In task lists, add space after checkbox
   */
  const renderChildren = () => {
    const children = props.node.children;
    const loose = props.loose ?? props.node.spread ?? false;

    // Helper to unwrap paragraph content
    const unwrapParagraph = (node: RootContent) => {
      if (node.type === "paragraph") {
        return <NodesRenderer nodes={node.children} />;
      }
      return renderSingleNode(node);
    };

    // Render results array
    const results: JSX.Element[] = [];

    for (let index = 0; index < children.length; index++) {
      const child = children[index];

      // In tight lists, unwrap first paragraph, keep others as-is
      if (!loose && index === 0 && child.type === "paragraph") {
        results.push(unwrapParagraph(child));
      } else {
        results.push(renderSingleNode(child));
      }
    }

    return results;
  };

  const isTaskList = () => props.node.checked !== null;

  return (
    <li
      classList={{
        "task-list-item": isTaskList(),
      }}
    >
      <Show when={isTaskList()}>
        <input
          type="checkbox"
          checked={props.node.checked ?? undefined}
          disabled
          class="task-list-item-checkbox"
          aria-label={props.node.checked ? "Completed task" : "Incomplete task"}
        />
        {/* Add space after checkbox for better readability */}{" "}
      </Show>
      {renderChildren()}
    </li>
  );
};

const BlockquoteNode: Component<{ node: RootContentMap["blockquote"] }> = (props) => {
  return (
    <blockquote>
      <NodesRenderer nodes={props.node.children} />
    </blockquote>
  );
};

const ThematicBreakNode: Component = () => {
  return <hr />;
};

const BreakNode: Component = () => {
  return <br />;
};

const TableNode: Component<{ node: RootContentMap["table"] }> = (props) => {
  return (
    <table>
      <Show when={props.node.children[0]}>
        <thead>
          <For each={[props.node.children[0]]}>{(row) => <TableRowNode node={row} />}</For>
        </thead>
      </Show>
      <Show when={props.node.children.length > 1}>
        <tbody>
          <For each={props.node.children.slice(1)}>{(row) => <TableRowNode node={row} />}</For>
        </tbody>
      </Show>
    </table>
  );
};

const TableRowNode: Component<{ node: RootContentMap["tableRow"] }> = (props) => {
  return (
    <tr>
      <For each={props.node.children}>{(cell) => <TableCellNode node={cell} />}</For>
    </tr>
  );
};

const TableCellNode: Component<{ node: RootContentMap["tableCell"] }> = (props) => {
  return (
    <td>
      <NodesRenderer nodes={props.node.children} />
    </td>
  );
};

const HtmlNode: Component<{ node: RootContentMap["html"] }> = (props) => {
  // HTML nodes are rendered as-is (potentially unsafe, consider sanitization)
  // oxlint-disable-next-line solid/no-innerhtml: HTML content from markdown
  return <div innerHTML={props.node.value} />;
};

const YamlNode: Component<{ node: RootContentMap["yaml"] }> = (props) => {
  const parsed = createMemo(() => {
    const parsed = parseFrontmatterYamlString(props.node.value);
    if (!parsed.success) {
      return null;
    }
    return parsed.data;
  });

  return (
    <div class="">
      {/* Title Display */}
      <Show when={parsed()?.title}>
        <h1 class="text-text-primary mb-4 text-3xl font-bold">{parsed()?.title}</h1>
      </Show>

      {/* Tags Display */}
      <Show when={parsed()?.tags?.length}>
        <div class="mb-4 flex flex-wrap gap-2">
          {
            <For each={parsed()?.tags}>
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

const FootnoteReferenceNode: Component<{ node: RootContentMap["footnoteReference"] }> = (props) => {
  return (
    <sup>
      <a
        id={`fnref-${props.node.identifier}`}
        href={`#fn-${props.node.identifier}`}
        data-footnote-ref
      >
        {props.node.identifier}
      </a>
    </sup>
  );
};

const FootnoteBackLinkNode: Component<{ node: RootContentMap["footnote-back-link"] }> = (props) => {
  return <a href={props.node.url}>↩</a>;
};

const UnknownNode: Component<{ node: Node }> = (props) => {
  return (
    <Show
      when={import.meta.env.DEV}
      fallback={
        <>
          {/* oxlint-disable-next-line solid/reactivity: node type doesn't change */}
          {console.warn(`Unhandled node type: ${props.node.type}`)}
        </>
      }
    >
      <div>
        <p class="text-text-danger">Unknown node type: {props.node.type}</p>
        <pre>{JSON.stringify(props.node, null, 2)}</pre>
      </div>
    </Show>
  );
};

const FootNotesSection: Component<{ footnotes: RootContentMap["footnoteDefinition"][] }> = (
  props,
) => {
  return (
    <section data-footnotes class="footnotes">
      <ol>
        <For each={props.footnotes}>
          {(fn) => (
            <li id={`fn-${fn.identifier}`}>
              <NodesRenderer nodes={fn.children} />
            </li>
          )}
        </For>
      </ol>
    </section>
  );
};

/**
 * Render a single node (used by ListItemNode for custom rendering)
 */
const renderSingleNode = (node: RenderableNode): JSX.Element => {
  switch (node.type) {
    case "text":
      return <TextNode node={node as RootContentMap["text"]} />;
    case "paragraph":
      return <ParagraphNode node={node as RootContentMap["paragraph"]} />;
    case "heading":
      return <HeadingNode node={node as RootContentMap["heading"]} />;
    case "emphasis":
      return <EmphasisNode node={node as RootContentMap["emphasis"]} />;
    case "strong":
      return <StrongNode node={node as RootContentMap["strong"]} />;
    case "delete":
      return <DeleteNode node={node as RootContentMap["delete"]} />;
    case "link":
      return <LinkNode node={node as RootContentMap["link"]} />;
    case "image":
      return <ImageNode node={node as RootContentMap["image"]} />;
    case "inlineCode":
      return <InlineCodeNode node={node as RootContentMap["inlineCode"]} />;
    case "code":
      return <CodeNode node={node as RootContentMap["code"]} />;
    case "list":
      return <ListNode node={node as RootContentMap["list"]} />;
    case "listItem":
      return <ListItemNode node={node as RootContentMap["listItem"]} />;
    case "blockquote":
      return <BlockquoteNode node={node as RootContentMap["blockquote"]} />;
    case "thematicBreak":
      return <ThematicBreakNode />;
    case "break":
      return <BreakNode />;
    case "table":
      return <TableNode node={node as RootContentMap["table"]} />;
    case "tableRow":
      return <TableRowNode node={node as RootContentMap["tableRow"]} />;
    case "tableCell":
      return <TableCellNode node={node as RootContentMap["tableCell"]} />;
    case "html":
      return <HtmlNode node={node as RootContentMap["html"]} />;
    case "yaml":
      return <YamlNode node={node as RootContentMap["yaml"]} />;
    case "footnoteReference":
      return <FootnoteReferenceNode node={node as RootContentMap["footnoteReference"]} />;
    case "footnote-back-link":
      return <FootnoteBackLinkNode node={node as RootContentMap["footnote-back-link"]} />;
    case "imageReference":
    case "linkReference":
    case "footnoteDefinition":
    case "definition":
      return null;
    default:
      return <UnknownNode node={node} />;
  }
};

// ============================================================================
// NodesRenderer - Main rendering component
// ============================================================================

const NodesRenderer: Component<{ nodes: readonly RenderableNode[] }> = (props) => {
  return <For each={props.nodes}>{(node) => renderSingleNode(node)}</For>;
};

const extractFootnotes = (
  nodes: readonly RootContent[],
): RootContentMap["footnoteDefinition"][] => {
  const footnotes: RootContentMap["footnoteDefinition"][] = [];
  const traverse = (nodes: readonly RootContent[]) => {
    for (const node of nodes) {
      if (node.type === "footnoteDefinition") {
        footnotes.push(node);
      }
      if ("children" in node) {
        traverse(node.children);
      }
    }
  };
  traverse(nodes);
  return footnotes;
};

// ============================================================================
// MarkdownRenderer - Top-level component
// ============================================================================

const MarkdownRenderer: Component<MarkdownRendererProps> = (props) => {
  // Parse markdown AST
  const [ast] = createResource(
    () => props.content,
    async (content) => {
      try {
        const processor = unified()
          .use(remarkParse)
          .use(remarkFrontmatter, ["yaml"])
          .use(remarkFootnoteBackLink) // Custom plugin to add back-links to footnotes
          .use(remarkGfm);
        const tree = processor.parse(content);
        const transformed = await processor.run(tree);
        return transformed as Root;
      } catch (error) {
        console.error("Failed to parse markdown:", error);
        return null;
      }
    },
  );

  const footnotes = createMemo(() => {
    if (!ast.latest) return [];
    return extractFootnotes(ast.latest.children);
  });

  return (
    <div class="markdown-body h-full w-full overflow-auto p-4">
      <Show when={ast.latest} fallback={<p>Error parsing markdown</p>}>
        {(tree) => (
          <>
            <NodesRenderer nodes={tree().children} />
            <Show when={footnotes().length > 0}>
              <FootNotesSection footnotes={footnotes()} />
            </Show>
          </>
        )}
      </Show>
    </div>
  );
};

export default MarkdownRenderer;
