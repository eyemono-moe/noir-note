import { nameToEmoji } from "gemoji";

export interface EmojiEntry {
  shortcode: string;
  emoji: string;
}

/**
 * Flat list of all emoji entries sorted alphabetically by shortcode.
 * Used as the data source for the editor autocomplete.
 */
export const emojiList: readonly EmojiEntry[] = Object.entries(nameToEmoji)
  .map(([shortcode, emoji]) => ({ shortcode, emoji }))
  .sort((a, b) => a.shortcode.localeCompare(b.shortcode));
