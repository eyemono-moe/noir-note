import type { JSX } from "solid-js";

/**
 * Item model for the insertion picker. Independent of CodeMirror so it can
 * also be used by inline trigger UIs and tests.
 */
export interface InsertionPickerItem {
  /** Unique identifier within the request. */
  value: string;
  /** Primary display label (used as fallback search target). */
  label: string;
  /** Optional secondary line shown beneath the label. */
  description?: string;
  /** Optional icon class (e.g. UnoCSS `i-material-symbols:*`). */
  icon?: string;
  /**
   * Optional preview content rendered alongside / below the label. Kept as
   * JSX so callers can render Markdown previews, code, etc.
   */
  preview?: () => JSX.Element;
  /** Extra search keywords that should match in addition to `label`. */
  keywords?: string[];
}

/**
 * Request payload for opening the insertion picker.
 *
 * `replace` lets inline trigger callers describe a range they want the
 * accepted item to replace (e.g. the `[[query` text that triggered the popup).
 * Picker UI uses it as the default replace range when invoking `onAccept`.
 */
export interface InsertionPickerRequest {
  /** Title shown at the top of the picker dialog. */
  title: string;
  /** Placeholder text for the search input. */
  placeholder?: string;
  /** Items shown to the user. May be filtered as the user types. */
  items: InsertionPickerItem[];
  /** Optional initial query string. */
  initialQuery?: string;
  /** Optional document range to replace when an item is accepted. */
  replace?: { from: number; to: number };
  /**
   * Called when the user selects an item. Receivers should perform the
   * actual insertion (typically via `insertIntoEditor` with the request's
   * `replace` range, if provided).
   */
  onAccept: (item: InsertionPickerItem, replace?: { from: number; to: number }) => void;
  /** Optional cancel hook for cleanup (e.g. removing trigger text). */
  onCancel?: () => void;
}
