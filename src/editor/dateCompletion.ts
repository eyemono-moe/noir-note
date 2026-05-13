import type { CompletionContext, CompletionResult } from "@codemirror/autocomplete";

import { buildDateInsertions } from "../utils/dateInsertions";

/**
 * CodeMirror completion source for inline date/time tokens.
 *
 * Triggers on `@word` not immediately preceded by a word character so
 * tokens inside emails or identifiers (e.g. `user@example`) don't fire.
 *
 * Returning both `from` and `to` ensures the trigger text (e.g. `@today`) is
 * replaced when the candidate is accepted, instead of inserting the value
 * after it.
 */
export function dateCompletionSource(context: CompletionContext): CompletionResult | null {
  // (?<![\w]) — exclude '@' preceded by letters/digits/underscore (e.g. email locals).
  const match = context.matchBefore(/(?<![\w])@\w*/);
  if (!match) return null;
  // Only show completions after the user types past the '@' (or on explicit request).
  if (match.from === match.to && !context.explicit) return null;

  const query = match.text.slice(1).toLowerCase(); // strip leading '@'
  const entries = buildDateInsertions(new Date());

  const filtered = entries.filter((e) => e.trigger.slice(1).toLowerCase().startsWith(query));
  if (filtered.length === 0) return null;

  return {
    from: match.from,
    to: match.to,
    options: filtered.map(({ trigger, value, description }) => ({
      label: trigger,
      displayLabel: `${trigger} → ${value}`,
      detail: description,
      apply: value,
    })),
    // We already filtered against the trigger; CodeMirror keeps refining as the user types more.
    filter: false,
  };
}
