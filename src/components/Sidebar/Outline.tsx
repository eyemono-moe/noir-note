import { EditorView } from "@codemirror/view";
import { createMemo, For, type Component } from "solid-js";

import { useCurrentMemo } from "../../context/currentMemo";
import { useEditorContext } from "../../context/editor";

// ── Types ────────────────────────────────────────────────────────────────────

interface Heading {
  level: number;
  text: string;
  lineIndex: number;
}

// ── Heading parsing ───────────────────────────────────────────────────────────

function parseHeadings(content: string): Heading[] {
  const lines = content.split("\n");
  const headings: Heading[] = [];
  let inFrontmatter = lines[0]?.trim() === "---";
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    if (i === 0 && line.trim() === "---") {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (line.trim() === "---" || line.trim() === "...") {
        inFrontmatter = false;
      }
      continue;
    }

    if (/^(`{3,}|~{3,})/.test(line)) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      headings.push({ level: match[1].length, text: match[2].trim(), lineIndex: i });
    }
  }

  return headings;
}

// ── Outline ───────────────────────────────────────────────────────────────────

export const Outline: Component = () => {
  const { content } = useCurrentMemo();
  const { editorView } = useEditorContext();

  const headings = createMemo(() => parseHeadings(content()));
  const minLevel = createMemo(() => {
    const levels = headings().map((h) => h.level);
    return levels.length > 0 ? Math.min(...levels) : 1;
  });

  const handleClick = (lineIndex: number) => {
    const view = editorView();
    if (!view) return;
    const line = view.state.doc.line(lineIndex + 1);
    view.dispatch({
      selection: { anchor: line.from },
      effects: EditorView.scrollIntoView(line.from, { y: "start", yMargin: 20 }),
    });
    view.focus();
  };

  return (
    <div class="flex flex-col gap-0.5 p-1">
      <For
        each={headings()}
        fallback={<div class="text-text-secondary px-4 py-8 text-center text-sm">No headings</div>}
      >
        {(heading) => (
          <button
            type="button"
            class="focus-ring text-text-primary hover:bg-surface-transparent-hover flex w-full cursor-pointer items-center gap-1.5 rounded-md border-0 bg-transparent px-2 py-1 text-start text-sm leading-5 select-none"
            style={{ "padding-left": `calc(${heading.level - minLevel()} * 0.75rem + 0.5rem)` }}
            onClick={() => handleClick(heading.lineIndex)}
            title={heading.text}
          >
            <span class="text-text-secondary shrink-0 font-mono text-[0.6875rem] leading-4">
              {"#".repeat(heading.level)}
            </span>
            <span class="w-full truncate">{heading.text}</span>
          </button>
        )}
      </For>
    </div>
  );
};
