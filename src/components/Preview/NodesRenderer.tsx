import { Clipboard } from "@ark-ui/solid";
import type { Node, RootContent, RootContentMap } from "mdast";
import type { Component, JSX } from "solid-js";
import {
  For,
  Match,
  Show,
  Suspense,
  Switch,
  createEffect,
  createMemo,
  createResource,
  onCleanup,
  useContext,
} from "solid-js";

import { useTheme } from "../../context/theme";
import { getImageUrl } from "../../db/imageStore";
import { bundledLanguages, codeToHtml } from "../../editor/shiki.bundle";
import { useEmbedConfig } from "../../store/configStore";
import { parseFrontmatterYamlString } from "../../utils/frontmatter";
import {
  CheckboxToggleContext,
  DefinitionsContext,
  LightboxContext,
  MermaidRegistryContext,
} from "./contexts";
import { EMBED_MATCHERS, EmbedRenderer } from "./embeds";

// ============================================================================
// Types
// ============================================================================

type RenderableNode = RootContent;

// ============================================================================
// createResolvedImageSrc — shared image URL resolver
// ============================================================================

/**
 * SolidJS primitive that resolves an image URL to a renderable `src` string.
 * Handles `attachment://` URLs by fetching an object URL via `getImageUrl`.
 *
 * Returns `() => string | null`. `null` means the URL is not yet ready — do
 * not pass it to `<img src>` directly as it would render a broken-image icon.
 *
 * `createResource` uses `initialValue: null` so it never suspends. Always
 * read the result via `.latest`, not the call form, to avoid propagating the
 * pending state to the nearest Suspense boundary.
 */
export function createResolvedImageSrc(url: () => string | null | undefined): () => string | null {
  const attachmentId = (): string | null => {
    const u = url();
    return u?.startsWith("attachment://") ? u.slice("attachment://".length) : null;
  };

  const [objectUrl] = createResource(attachmentId, (id) => getImageUrl(id), {
    initialValue: null,
  });

  // Revoke the object URL whenever it changes or the component is unmounted.
  createEffect(() => {
    const u = objectUrl.latest;
    onCleanup(() => {
      if (u) URL.revokeObjectURL(u);
    });
  });

  const src = createMemo(() => {
    const u = url();
    if (!u) return null;
    if (!u.startsWith("attachment://")) return u;
    return objectUrl.latest ?? null;
  });
  return src;
}

// ============================================================================
// Node Components
// ============================================================================

const TextNode: Component<{ node: RootContentMap["text"] }> = (props) => {
  return <>{props.node.value}</>;
};

const ParagraphNode: Component<{ node: RootContentMap["paragraph"] }> = (props) => {
  const embedConfig = useEmbedConfig();

  // Step 1 — pure URL→service match. Does NOT read config, so this memo only
  // re-evaluates when the paragraph URL changes (i.e. the user edits the note).
  // Because config changes never touch this memo, the returned EmbedInfo object
  // keeps a stable reference across config-only updates.
  const matchedEmbed = createMemo(() => {
    const url = props.node.data?.embedLinkUrl;
    if (!url) return null;
    for (const matcher of EMBED_MATCHERS) {
      const info = matcher.match(url);
      if (info) return info;
    }
    return null;
  });

  // Step 2 — config gate. Passes the *same* EmbedInfo reference from step 1
  // through when the service is enabled, so downstream effects (e.g.
  // TwitterEmbed's createEffect) see no change — and do not re-run — when an
  // unrelated embed setting is toggled.
  const embedInfo = createMemo(() => {
    const info = matchedEmbed();
    if (!info) return null;
    const config = embedConfig();
    if (!config.global) return null;
    if (config.services[info.matcherId] === false) return null;
    return info;
  });

  return (
    <Show
      when={embedInfo()}
      fallback={
        <p data-source-line={props.node.position?.start?.line}>
          <NodesRenderer nodes={props.node.children} />
        </p>
      }
    >
      {(info) => <EmbedRenderer info={info()} sourceLine={props.node.position?.start?.line} />}
    </Show>
  );
};

const HeadingNode: Component<{ node: RootContentMap["heading"] }> = (props) => {
  const sourceLine = () => props.node.position?.start?.line;
  const children = <NodesRenderer nodes={props.node.children} />;
  return (
    <Switch>
      <Match when={props.node.depth === 1}>
        <h1 data-source-line={sourceLine()}>{children}</h1>
      </Match>
      <Match when={props.node.depth === 2}>
        <h2 data-source-line={sourceLine()}>{children}</h2>
      </Match>
      <Match when={props.node.depth === 3}>
        <h3 data-source-line={sourceLine()}>{children}</h3>
      </Match>
      <Match when={props.node.depth === 4}>
        <h4 data-source-line={sourceLine()}>{children}</h4>
      </Match>
      <Match when={props.node.depth === 5}>
        <h5 data-source-line={sourceLine()}>{children}</h5>
      </Match>
      <Match when={props.node.depth === 6}>
        <h6 data-source-line={sourceLine()}>{children}</h6>
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
  const openLightbox = useContext(LightboxContext);
  const src = createResolvedImageSrc(() => props.node.url);

  return (
    <button
      type="button"
      class="focus-ring cursor-zoom-in appearance-none border-0 bg-transparent p-0"
      onClick={() => openLightbox(props.node.position?.start?.offset ?? -1)}
    >
      <Show when={src()}>
        {(s) => (
          <img
            src={s()}
            alt={props.node.alt ?? ""}
            title={props.node.title ?? undefined}
            loading="lazy"
            decoding="async"
          />
        )}
      </Show>
    </button>
  );
};

const LinkReferenceNode: Component<{ node: RootContentMap["linkReference"] }> = (props) => {
  const getDefs = useContext(DefinitionsContext);
  const def = () => getDefs().get(props.node.identifier);
  const isAbsoluteURL = () => {
    const url = def()?.url;
    return url ? /^[a-z][a-z0-9+.-]*:/.test(url) : false;
  };

  return (
    <Show when={def()} fallback={<NodesRenderer nodes={props.node.children} />}>
      {(d) => (
        <a
          href={d().url}
          title={d().title ?? undefined}
          target={isAbsoluteURL() ? "_blank" : undefined}
          rel={isAbsoluteURL() ? "noopener noreferrer" : undefined}
        >
          <NodesRenderer nodes={props.node.children} />
        </a>
      )}
    </Show>
  );
};

const ImageReferenceNode: Component<{ node: RootContentMap["imageReference"] }> = (props) => {
  const getDefs = useContext(DefinitionsContext);
  const openLightbox = useContext(LightboxContext);
  const def = () => getDefs().get(props.node.identifier);
  const src = createResolvedImageSrc(() => def()?.url);

  return (
    <Show when={def()}>
      {(d) => (
        <button
          type="button"
          class="focus-ring cursor-zoom-in appearance-none border-0 bg-transparent p-0"
          onClick={() => openLightbox(props.node.position?.start?.offset ?? -1)}
        >
          <Show when={src()}>
            {(s) => (
              <img
                src={s()}
                alt={props.node.alt ?? ""}
                title={d().title ?? undefined}
                loading="lazy"
                decoding="async"
              />
            )}
          </Show>
        </button>
      )}
    </Show>
  );
};

const InlineCodeNode: Component<{ node: RootContentMap["inlineCode"] }> = (props) => {
  return <code>{props.node.value}</code>;
};

/**
 * Mermaid diagram renderer component
 */
const MermaidDiagram: Component<{ code: string; offset: number }> = (props) => {
  const isDark = useTheme();
  const openLightbox = useContext(LightboxContext);
  const registry = useContext(MermaidRegistryContext);

  const [result] = createResource(
    () => ({ code: props.code, dark: isDark() }),
    async (params) => {
      try {
        const { default: mermaid } = await import("mermaid");
        const id = `mermaid-${Math.random().toString(36).substring(2, 11)}`;
        mermaid.initialize({
          startOnLoad: false,
          theme: params.dark ? "dark" : "default",
          suppressErrorRendering: true,
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

  // Register this diagram in the carousel when rendering succeeds;
  // unregister on failure or unmount so failed diagrams are excluded.
  createEffect(() => {
    if (result.latest?.success) {
      registry.register(props.offset);
      onCleanup(() => registry.unregister(props.offset));
    }
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
      <button
        type="button"
        class="focus-ring w-full cursor-zoom-in appearance-none border-0 bg-transparent p-0"
        onClick={() => openLightbox(props.offset)}
      >
        <div
          class="mermaid-diagram bg-surface-secondary flex justify-center rounded-lg p-2"
          // oxlint-disable-next-line solid/no-innerhtml
          innerHTML={result.latest?.svg}
        />
      </button>
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
        void import("../../styles/shiki.css");
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
    <div class="parent relative" data-source-line={props.node.position?.start?.line}>
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
          {/* Skeleton while Mermaid downloads and renders. On error, MermaidDiagram
              falls back to showing the source code with an error message. */}
          <Suspense
            fallback={<div class="bg-surface-secondary mb-4 min-h-32 animate-pulse rounded-lg" />}
          >
            <MermaidDiagram
              code={props.node.value}
              offset={props.node.position?.start?.offset ?? -1}
            />
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
        <ol
          start={props.node.start ?? undefined}
          data-source-line={props.node.position?.start?.line}
        >
          <For each={props.node.children}>
            {(item) => <ListItemNode node={item} loose={loose()} />}
          </For>
        </ol>
      ) : (
        <ul data-source-line={props.node.position?.start?.line}>
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
  const getOnToggle = useContext(CheckboxToggleContext);

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

  const isTaskList = () => props.node.checked !== null && props.node.checked !== undefined;

  const handleCheckboxClick = () => {
    // The browser's default behavior toggles the checkbox immediately (good UX).
    // We also update the source content so the mdast checked state follows.
    const offset = props.node.position?.start?.offset;
    if (offset !== undefined) {
      getOnToggle()?.(offset, props.node.checked ?? false);
    }
  };

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
          disabled={!getOnToggle()}
          class="task-list-item-checkbox"
          aria-label={props.node.checked ? "Completed task" : "Incomplete task"}
          onClick={handleCheckboxClick}
        />
        {/* Add space after checkbox for better readability */}{" "}
      </Show>
      {renderChildren()}
    </li>
  );
};

const BlockquoteNode: Component<{ node: RootContentMap["blockquote"] }> = (props) => {
  return (
    <blockquote data-source-line={props.node.position?.start?.line}>
      <NodesRenderer nodes={props.node.children} />
    </blockquote>
  );
};

const ThematicBreakNode: Component<{ node: RootContentMap["thematicBreak"] }> = (props) => {
  return <hr data-source-line={props.node.position?.start?.line} />;
};

const BreakNode: Component = () => {
  return <br />;
};

const TableNode: Component<{ node: RootContentMap["table"] }> = (props) => {
  return (
    <table data-source-line={props.node.position?.start?.line}>
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

const MathNode: Component<{ node: RootContentMap["math"] | RootContentMap["inlineMath"] }> = (
  props,
) => {
  const isBlock = () => props.node.type === "math";

  const [result] = createResource(
    () => [props.node.value, isBlock()] as const,
    async ([code, displayMode]) => {
      try {
        void import("katex/dist/katex.min.css");
        const { default: katex } = await import("katex");
        const html = katex.renderToString(code, {
          throwOnError: true,
          strict: "ignore",
          displayMode,
        });
        return { success: true as const, html };
      } catch (e) {
        return { success: false as const, error: String(e) };
      }
    },
  );

  return (
    <Suspense fallback={<code>{props.node.value}</code>}>
      <Switch>
        <Match when={result()?.success}>
          {/* oxlint-disable-next-line solid/no-innerhtml */}
          <span innerHTML={result()?.html} />{" "}
        </Match>
        <Match when={!result()?.success}>
          <Show
            when={isBlock()}
            fallback={
              <code class="text-text-danger" title={result()?.error}>
                {props.node.value}
              </code>
            }
          >
            <pre>
              <code>{props.node.value}</code>
            </pre>
            <div class="text-text-danger text-sm">
              <p>KaTeX rendering error:</p>
              <pre>{result()?.error}</pre>
            </div>
          </Show>
        </Match>
      </Switch>
    </Suspense>
  );
};

const HtmlNode: Component<{ node: RootContentMap["html"] }> = (props) => {
  // oxlint-disable-next-line solid/no-innerhtml: HTML content from markdown
  return <div data-source-line={props.node.position?.start?.line} innerHTML={props.node.value} />;
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
    <div class="" data-source-line={props.node.position?.start?.line}>
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

export const FootNotesSection: Component<{
  footnotes: RootContentMap["footnoteDefinition"][];
}> = (props) => {
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

// ============================================================================
// renderSingleNode + NodesRenderer
// ============================================================================

/**
 * Render a single node (used by ListItemNode for custom rendering)
 */
const renderSingleNode = (node: RenderableNode): JSX.Element => {
  switch (node.type) {
    case "text":
      return <TextNode node={node} />;
    case "paragraph":
      return <ParagraphNode node={node} />;
    case "heading":
      return <HeadingNode node={node} />;
    case "emphasis":
      return <EmphasisNode node={node} />;
    case "strong":
      return <StrongNode node={node} />;
    case "delete":
      return <DeleteNode node={node} />;
    case "link":
      return <LinkNode node={node} />;
    case "image":
      return <ImageNode node={node} />;
    case "inlineCode":
      return <InlineCodeNode node={node} />;
    case "code":
      return <CodeNode node={node} />;
    case "list":
      return <ListNode node={node} />;
    case "listItem":
      return <ListItemNode node={node} />;
    case "blockquote":
      return <BlockquoteNode node={node} />;
    case "thematicBreak":
      return <ThematicBreakNode node={node} />;
    case "break":
      return <BreakNode />;
    case "table":
      return <TableNode node={node} />;
    case "tableRow":
      return <TableRowNode node={node} />;
    case "tableCell":
      return <TableCellNode node={node} />;
    case "html":
      return <HtmlNode node={node} />;
    case "yaml":
      return <YamlNode node={node} />;
    case "footnoteReference":
      return <FootnoteReferenceNode node={node} />;
    case "footnote-back-link":
      return <FootnoteBackLinkNode node={node} />;
    case "imageReference":
      return <ImageReferenceNode node={node} />;
    case "linkReference":
      return <LinkReferenceNode node={node} />;
    case "math":
    case "inlineMath":
      return <MathNode node={node} />;
    case "footnoteDefinition":
    case "definition":
      return null;
    default:
      return <UnknownNode node={node} />;
  }
};

export const NodesRenderer: Component<{ nodes: readonly RenderableNode[] }> = (props) => {
  return <For each={props.nodes}>{(node) => renderSingleNode(node)}</For>;
};
