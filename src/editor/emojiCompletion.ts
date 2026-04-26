import { autocompletion } from "@codemirror/autocomplete";
import type { CompletionContext, CompletionResult } from "@codemirror/autocomplete";

import { emojiList } from "../utils/emoji";

const MAX_RESULTS = 50;

/**
 * CodeMirror completion source for emoji shortcodes.
 *
 * Triggers when the cursor follows a `:` character not immediately preceded by
 * a word character or `/` (to avoid false positives on URLs and times like
 * `10:30`). Starts-with matches are ranked before contains matches.
 */
function emojiCompletionSource(context: CompletionContext): CompletionResult | null {
  // (?<![/\w]) — exclude ':' preceded by '/', letters, digits, or '_'
  // so 'https://' and '10:30' won't trigger completion
  const match = context.matchBefore(/(?<![/\w]):[+\w-]*/);
  if (!match) return null;
  // Only show completions if the user has started typing (or explicitly requested)
  if (match.from === match.to && !context.explicit) return null;

  const query = match.text.slice(1).toLowerCase(); // strip leading ':'

  const startsWith: (typeof emojiList)[number][] = [];
  const contains: (typeof emojiList)[number][] = [];

  for (const entry of emojiList) {
    if (startsWith.length >= MAX_RESULTS) break;
    if (entry.shortcode.startsWith(query)) {
      startsWith.push(entry);
    } else if (query.length > 0 && entry.shortcode.includes(query)) {
      contains.push(entry);
    }
  }

  // Merge: starts-with matches first, then contains, capped at MAX_RESULTS
  const results = [...startsWith, ...contains].slice(0, MAX_RESULTS);

  return {
    from: match.from,
    options: results.map(({ shortcode, emoji }) => ({
      label: `:${shortcode}:`,
      displayLabel: `${emoji} ${shortcode}`,
      apply: `:${shortcode}:`,
    })),
    // Disable built-in re-filtering since we already apply our own ranking
    filter: false,
  };
}

export const emojiCompletionExtension = autocompletion({
  override: [emojiCompletionSource],
});
