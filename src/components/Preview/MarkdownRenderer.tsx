import { Carousel, Clipboard, Dialog } from "@ark-ui/solid";
import { ReactiveSet } from "@solid-primitives/set";
import type { Node, Root, RootContent, RootContentMap } from "mdast";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import type { Component, JSX } from "solid-js";
import {
  For,
  Match,
  Show,
  Suspense,
  Switch,
  createContext,
  createEffect,
  createMemo,
  createRenderEffect,
  createResource,
  createSignal,
  onCleanup,
  useContext,
} from "solid-js";
import { createStore, reconcile } from "solid-js/store";

import "../../styles/markdown.css";
import "../../styles/shiki.css";
import { unified } from "unified";

import { useTheme } from "../../context/theme";
import { getImageUrl } from "../../db/imageStore";
import { bundledLanguages, codeToHtml } from "../../editor/shiki.bundle";
import { parseFrontmatterYamlString } from "../../utils/frontmatter";
import { remarkEmoji } from "../../utils/remark/remark-emoji";
import { remarkFootnoteBackLink } from "../../utils/remark/remark-footnote-back-link";

// Processor is created once at module load and reused across all renders.
// All remark plugins are stateless transformers so this is safe.
const processor = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ["yaml"])
  .use(remarkFootnoteBackLink)
  .use(remarkGfm)
  .use(remarkEmoji);

interface MarkdownRendererProps {
  content: string;
  /** Called when a task list checkbox is clicked. offset is the document character
   *  offset of the list item's start (node.position.start.offset). */
  onCheckboxToggle?: (offset: number, checked: boolean) => void;
  /** Called with the scrollable container element once it is mounted. */
  containerRef?: (el: HTMLElement) => void;
}

/**
 * Context that carries the checkbox toggle callback down to ListItemNode without
 * prop-drilling through NodesRenderer / ListNode.
 * Stored as an accessor so that reactivity is preserved when the prop changes.
 */
type CheckboxToggleFn = (offset: number, checked: boolean) => void;
const CheckboxToggleContext = createContext<() => CheckboxToggleFn | undefined>(() => undefined);

/**
 * A single item that can be displayed in the lightbox carousel.
 * `offset` is the AST node's `position.start.offset` and serves as the unique
 * identity — even when the same URL or mermaid code appears multiple times.
 */
type LightboxItem =
  | { type: "image"; url: string; offset: number }
  | { type: "mermaid"; code: string; offset: number };

/**
 * Context that opens the lightbox at the item whose AST offset matches.
 * Using the offset (not the URL/code) correctly handles duplicate content.
 */
const LightboxContext = createContext<(offset: number) => void>(() => {});

/**
 * Context used by MermaidDiagram to notify MarkdownRenderer of render
 * success/failure, so the carousel only includes successfully rendered diagrams.
 */
type MermaidRegistry = { register: (offset: number) => void; unregister: (offset: number) => void };
const MermaidRegistryContext = createContext<MermaidRegistry>({
  register: () => {},
  unregister: () => {},
});

/**
 * Resolved definition data (url + optional title) keyed by identifier.
 */
type Definitions = Map<string, { url: string; title?: string | null }>;

/**
 * Context that provides a definitions lookup function to LinkReferenceNode and
 * ImageReferenceNode without prop-drilling. Stored as an accessor for reactivity.
 */
const DefinitionsContext = createContext<() => Definitions>(() => new Map());

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
    <p data-source-line={props.node.position?.start?.line}>
      <NodesRenderer nodes={props.node.children} />
    </p>
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

  const isAttachment = () => props.node.url.startsWith("attachment://");
  const attachmentId = () => (isAttachment() ? props.node.url.slice("attachment://".length) : null);

  // `initialValue: null` ensures the resource has a defined value from the start
  // and therefore never throws a Promise to Suspense — even when re-fetching
  // after an unnecessary remount caused by a reconcile-key shift.
  // Always access via `.latest` (not the call form) to avoid propagating the
  // pending state to the nearest <Suspense> boundary (= the root preview).
  // This mirrors the SyntaxHighlightedCode pattern.
  const [objectUrl] = createResource(attachmentId, (id) => getImageUrl(id), {
    initialValue: null,
  });

  // Revoke the object URL whenever it changes or the component is unmounted.
  createEffect(() => {
    const url = objectUrl.latest;
    onCleanup(() => {
      if (url) URL.revokeObjectURL(url);
    });
  });

  // Returns null while the attachment object-URL is being resolved so we never
  // pass an empty string to <img src>, which would render a broken-image icon.
  const src = (): string | null => {
    if (!isAttachment()) return props.node.url;
    return objectUrl.latest ?? null;
  };

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

  const isAttachment = () => (def()?.url ?? "").startsWith("attachment://");
  const attachmentId = () =>
    isAttachment() ? (def()?.url.slice("attachment://".length) ?? null) : null;

  const [objectUrl] = createResource(attachmentId, (id) => getImageUrl(id), {
    initialValue: null,
  });

  createEffect(() => {
    const url = objectUrl.latest;
    onCleanup(() => {
      if (url) URL.revokeObjectURL(url);
    });
  });

  const src = (): string | null => {
    const d = def();
    if (!d) return null;
    if (!isAttachment()) return d.url;
    return objectUrl.latest ?? null;
  };

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

// ---------------------------------------------------------------------------
// Lightbox helpers (used by MarkdownRenderer)
// ---------------------------------------------------------------------------

/**
 * Walk the AST and collect all `definition` nodes into a lookup map.
 * Definitions can appear at any block level, so the walk is recursive.
 */
function collectDefinitions(nodes: readonly RootContent[]): Definitions {
  const defs = new Map<string, { url: string; title?: string | null }>();
  function walk(node: RootContent) {
    if (node.type === "definition") {
      defs.set(node.identifier, { url: node.url, title: node.title });
    }
    if ("children" in node) {
      for (const child of (node as { children: RootContent[] }).children) walk(child);
    }
  }
  for (const node of nodes) walk(node);
  return defs;
}

/**
 * Collect all lightbox items (images and Mermaid diagrams) from an AST subtree
 * in document order. Used to build the prev/next navigation list for the lightbox.
 * `defs` is required to resolve `imageReference` nodes to their URLs.
 */
function collectLightboxItems(nodes: readonly RootContent[], defs: Definitions): LightboxItem[] {
  const items: LightboxItem[] = [];
  function walk(node: RootContent) {
    if (node.type === "image") {
      items.push({ type: "image", url: node.url, offset: node.position?.start?.offset ?? -1 });
    } else if (node.type === "imageReference") {
      const def = defs.get(node.identifier);
      if (def) {
        items.push({ type: "image", url: def.url, offset: node.position?.start?.offset ?? -1 });
      }
    } else if (node.type === "code" && node.lang === "mermaid") {
      items.push({ type: "mermaid", code: node.value, offset: node.position?.start?.offset ?? -1 });
    }
    if ("children" in node) {
      for (const child of (node as { children: RootContent[] }).children) walk(child);
    }
  }
  for (const node of nodes) walk(node);
  return items;
}

/**
 * Full-size image rendered inside the lightbox dialog.
 * Resolves attachment:// URLs the same way ImageNode does.
 */
const LightboxImage: Component<{ url: string }> = (props) => {
  const attachmentId = () =>
    props.url.startsWith("attachment://") ? props.url.slice("attachment://".length) : null;

  const [objectUrl] = createResource(attachmentId, (id) => getImageUrl(id), { initialValue: null });

  createEffect(() => {
    const url = objectUrl.latest;
    onCleanup(() => {
      if (url) URL.revokeObjectURL(url);
    });
  });

  const src = (): string | null => {
    if (!attachmentId()) return props.url;
    return objectUrl.latest ?? null;
  };

  return (
    <Show
      when={src()}
      fallback={
        <div class="flex size-32 items-center justify-center">
          <span class="i-material-symbols:hourglass-empty text-text-secondary size-8 shrink-0 animate-spin" />
        </div>
      }
    >
      {(s) => (
        <img
          src={s()}
          alt=""
          class="max-h-full max-w-full rounded shadow-2xl [background:conic-gradient(#eee_90deg,transparent_90deg_180deg,#eee_180deg_270deg,transparent_270deg)_50%_50%/50px_50px,#fff]"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        />
      )}
    </Show>
  );
};

/**
 * Full-size Mermaid diagram rendered inside the lightbox dialog.
 * Re-renders the SVG with the current theme at a larger size.
 */
const LightboxMermaid: Component<{ code: string }> = (props) => {
  const isDark = useTheme();

  const [result] = createResource(
    () => ({ code: props.code, dark: isDark() }),
    async (params) => {
      try {
        const { default: mermaid } = await import("mermaid");
        const id = `mermaid-lb-${Math.random().toString(36).substring(2, 11)}`;
        mermaid.initialize({
          startOnLoad: false,
          theme: params.dark ? "dark" : "default",
          suppressErrorRendering: true,
        });
        const { svg } = await mermaid.render(id, params.code);

        // Extract max-width from the SVG's inline style (e.g. style="max-width: 629.78px;")
        // so the container hugs the SVG — clicks beside the diagram reach Dialog.Content.
        const maxWidthMatch = /max-width:\s*([\d.]+px)/.exec(svg);

        return {
          success: true as const,
          svg,
          maxWidth: maxWidthMatch ? maxWidthMatch[1] : undefined,
        };
      } catch (error) {
        console.error("Mermaid rendering failed:", error);
        return { success: false as const };
      }
    },
  );

  return (
    <Suspense>
      <Show
        when={result.latest?.success}
        fallback={
          <div class="flex size-32 items-center justify-center">
            <span class="i-material-symbols:hourglass-empty text-text-secondary size-8 shrink-0 animate-spin" />
          </div>
        }
      >
        <div
          role="img"
          aria-label="Mermaid diagram"
          class="children-[svg]:mx-auto children-[svg]:block children-[svg]:max-h-full children-[svg]:h-auto bg-surface-secondary max-h-full w-full min-w-0 rounded-lg"
          style={{ "max-width": result.latest?.maxWidth ?? "100%" }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          // oxlint-disable-next-line solid/no-innerhtml
          innerHTML={result.latest?.svg}
        />
      </Show>
    </Suspense>
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
// reconcile key helpers
// ============================================================================

/**
 * Add a synthetic `_$$rckey` property to each node based on its local index and type.
 * This is used as the reconcile key so that nodes of different types at the same
 * array position are treated as different items (new proxy), preventing reconcile
 * from overwriting e.g. a `table` proxy with `code` data, which would cause
 * `children` to be undefined when components still try to read it.
 */
function addReconcileKey(node: RenderableNode, localKey: string): any {
  const keyed = { ...node, _$$rckey: localKey };
  if ("children" in keyed && Array.isArray(keyed.children)) {
    keyed.children = keyed.children.map((child: RenderableNode, i: number) =>
      addReconcileKey(child, `${i}:${child.type}`),
    );
  }
  return keyed;
}

function withReconcileKeys(root: Root): Root {
  return {
    ...root,
    children: root.children.map((child, i) => addReconcileKey(child, `${i}:${child.type}`)),
  } as Root;
}

// ============================================================================
// MarkdownRenderer - Top-level component
// ============================================================================

const MarkdownRenderer: Component<MarkdownRendererProps> = (props) => {
  const [carouselContainerRef, setCarouselContainerRef] = createSignal<HTMLDivElement | null>(null);

  // Parse markdown AST asynchronously
  const [parseResult] = createResource(
    () => props.content,
    async (content) => {
      try {
        const tree = processor.parse(content);
        return await processor.run(tree);
      } catch (error) {
        console.error("Failed to parse markdown:", error);
        return null;
      }
    },
  );

  // Stable store for the AST. Updated via reconcile so that For loops can track
  // node identity by reference: unchanged nodes keep the same proxy object,
  // preventing SyntaxHighlightedCode / MermaidDiagram from unmounting and losing
  // their createResource state (which would trigger the fallback flash).
  const [ast, setAst] = createStore<Root>({ type: "root", children: [] });

  // createRenderEffect runs before the DOM commit, ensuring the store is updated
  // before Show/NodesRenderer re-evaluate in the same reactive flush.
  createRenderEffect(() => {
    const newAst = parseResult.latest;
    if (newAst) {
      setAst(reconcile(withReconcileKeys(newAst), { key: "_$$rckey" }));
    }
  });

  const footnotes = createMemo(() => extractFootnotes(ast.children));
  const checkboxToggle = createMemo(() => props.onCheckboxToggle);
  const definitions = createMemo(() => collectDefinitions(ast.children));

  // ── Lightbox ──────────────────────────────────────────────────────────────

  // Track which mermaid offsets have successfully rendered.
  // Only those are included in the carousel.
  const mermaidSuccessOffsets = new ReactiveSet<number>();
  const mermaidRegistry: MermaidRegistry = {
    register: (offset) => mermaidSuccessOffsets.add(offset),
    unregister: (offset) => mermaidSuccessOffsets.delete(offset),
  };

  // All lightbox items in document order. Mermaid items are included only after
  // successful render; images are always included.
  const lightboxItems = createMemo(() =>
    collectLightboxItems(ast.children, definitions()).filter(
      (item) => item.type === "image" || mermaidSuccessOffsets.has(item.offset),
    ),
  );

  // null = dialog closed; number = index of the currently displayed item.
  const [lightboxIndex, setLightboxIndex] = createSignal<number | null>(null);

  const openLightbox = (offset: number) => {
    const index = lightboxItems().findIndex((i) => i.offset === offset);
    if (index !== -1) setLightboxIndex(index);
  };

  return (
    <>
      <MermaidRegistryContext.Provider value={mermaidRegistry}>
        <LightboxContext.Provider value={openLightbox}>
          <CheckboxToggleContext.Provider value={checkboxToggle}>
            <DefinitionsContext.Provider value={definitions}>
              <div ref={props.containerRef} class="markdown-body h-full w-full overflow-auto p-4">
                <Show when={parseResult.latest} fallback={<p>Error parsing markdown</p>}>
                  <>
                    <NodesRenderer nodes={ast.children} />
                    <Show when={footnotes().length > 0}>
                      <FootNotesSection footnotes={footnotes()} />
                    </Show>
                  </>
                </Show>
              </div>
            </DefinitionsContext.Provider>
          </CheckboxToggleContext.Provider>
        </LightboxContext.Provider>

        {/* ── Lightbox Dialog ─────────────────────────────────────────────── */}
        <Dialog.Root
          open={lightboxIndex() !== null}
          onOpenChange={(details) => {
            if (!details.open) setLightboxIndex(null);
          }}
          lazyMount
          unmountOnExit
          initialFocusEl={carouselContainerRef}
        >
          <Dialog.Backdrop class="bg-overlay fixed inset-0 z-50" />
          {/*
          Positioner covers the entire viewport. Content fills it so that the
          close button can be absolutely anchored to the top-right corner
          independent of image size.
        */}
          <Dialog.Positioner class="fixed inset-0 z-50">
            <Dialog.Content
              class="size-screen relative flex flex-col items-center justify-center gap-3 p-8 outline-none"
              onClick={() => setLightboxIndex(null)}
            >
              {/* Close — always top-right regardless of image size */}
              <Dialog.CloseTrigger class="focus-ring hover:bg-surface-transparent-hover text-text-secondary absolute top-4 right-4 inline-flex appearance-none rounded-full bg-transparent p-1.5 transition-colors">
                <span class="i-material-symbols:close-rounded size-5" />
              </Dialog.CloseTrigger>

              {/* Carousel — one slide per image */}
              <Carousel.Root
                slideCount={lightboxItems().length}
                loop
                page={lightboxIndex() ?? 0}
                onPageChange={(d) => setLightboxIndex(d.page)}
                class="flex w-full flex-col items-center gap-3 overflow-hidden"
              >
                <Carousel.ItemGroup
                  class="flex-1 overflow-hidden rounded outline-none"
                  ref={setCarouselContainerRef}
                >
                  <For each={lightboxItems()}>
                    {(item, i) => (
                      <Carousel.Item
                        index={i()}
                        class="flex items-center justify-center overflow-hidden"
                      >
                        <Switch>
                          <Match when={item.type === "image"}>
                            <LightboxImage url={(item as { url: string }).url} />
                          </Match>
                          <Match when={item.type === "mermaid"}>
                            <LightboxMermaid code={(item as { code: string }).code} />
                          </Match>
                        </Switch>
                      </Carousel.Item>
                    )}
                  </For>
                </Carousel.ItemGroup>

                <Show when={lightboxItems().length > 1}>
                  <Carousel.Control
                    class="flex shrink-0 items-center justify-center gap-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Carousel.PrevTrigger
                      title="Previous image (←)"
                      class="focus-ring hover:bg-surface-transparent-hover text-text-secondary inline-flex appearance-none rounded-full bg-transparent p-1.5 transition-colors"
                    >
                      <span class="i-material-symbols:chevron-left-rounded size-5" />
                    </Carousel.PrevTrigger>
                    <Carousel.ProgressText class="text-text-secondary min-w-12 text-center text-sm tabular-nums select-none" />
                    <Carousel.NextTrigger
                      title="Next image (→)"
                      class="focus-ring hover:bg-surface-transparent-hover text-text-secondary inline-flex appearance-none rounded-full bg-transparent p-1.5 transition-colors"
                    >
                      <span class="i-material-symbols:chevron-right-rounded size-5" />
                    </Carousel.NextTrigger>
                  </Carousel.Control>
                </Show>
              </Carousel.Root>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Root>
      </MermaidRegistryContext.Provider>
    </>
  );
};

export default MarkdownRenderer;
