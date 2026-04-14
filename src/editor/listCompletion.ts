import type { Extension } from "@codemirror/state";
import { keymap } from "@codemirror/view";

export const listCompletion: Extension = keymap.of([
  {
    key: "Enter",
    run: (view) => {
      const { state } = view;
      const { selection } = state;
      const { main } = selection;
      const line = state.doc.lineAt(main.head);
      const lineText = line.text;

      // Match unordered list items: -, *, +
      const unorderedMatch = lineText.match(/^(\s*)([-*+])\s+(.*)$/);
      if (unorderedMatch) {
        const [, indent, marker, content] = unorderedMatch;

        // If the line only has the marker (no content), remove the marker
        if (content.trim() === "") {
          view.dispatch({
            changes: {
              from: line.from,
              to: line.to,
              insert: indent,
            },
            selection: { anchor: line.from + indent.length },
          });
          return true;
        }

        // Insert new list item
        view.dispatch({
          changes: {
            from: main.head,
            to: main.head,
            insert: `\n${indent}${marker} `,
          },
          selection: { anchor: main.head + indent.length + marker.length + 2 },
        });
        return true;
      }

      // Match ordered list items: 1., 2., etc.
      const orderedMatch = lineText.match(/^(\s*)(\d+)\.\s+(.*)$/);
      if (orderedMatch) {
        const [, indent, num, content] = orderedMatch;

        // If the line only has the number (no content), remove the list item
        if (content.trim() === "") {
          view.dispatch({
            changes: {
              from: line.from,
              to: line.to,
              insert: indent,
            },
            selection: { anchor: line.from + indent.length },
          });
          return true;
        }

        // Insert new list item with incremented number
        const nextNum = Number.parseInt(num, 10) + 1;
        view.dispatch({
          changes: {
            from: main.head,
            to: main.head,
            insert: `\n${indent}${nextNum}. `,
          },
          selection: { anchor: main.head + indent.length + `${nextNum}. `.length + 1 },
        });
        return true;
      }

      // Default enter behavior
      return false;
    },
  },
]);
