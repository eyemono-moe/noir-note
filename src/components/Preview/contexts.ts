import { createContext } from "solid-js";

// ============================================================================
// CheckboxToggle context
// ============================================================================

export type CheckboxToggleFn = (offset: number, checked: boolean) => void;

/**
 * Context that carries the checkbox toggle callback down to ListItemNode without
 * prop-drilling through NodesRenderer / ListNode.
 * Stored as an accessor so that reactivity is preserved when the prop changes.
 */
export const CheckboxToggleContext = createContext<() => CheckboxToggleFn | undefined>(
  () => undefined,
);

// ============================================================================
// Lightbox context
// ============================================================================

/**
 * A single item that can be displayed in the lightbox carousel.
 * `offset` is the AST node's `position.start.offset` and serves as the unique
 * identity — even when the same URL or mermaid code appears multiple times.
 */
export type LightboxItem =
  | { type: "image"; url: string; offset: number }
  | { type: "mermaid"; code: string; offset: number };

/**
 * Context that opens the lightbox at the item whose AST offset matches.
 * Using the offset (not the URL/code) correctly handles duplicate content.
 */
export const LightboxContext = createContext<(offset: number) => void>(() => {});

// ============================================================================
// MermaidRegistry context
// ============================================================================

/**
 * Context used by MermaidDiagram to notify MarkdownRenderer of render
 * success/failure, so the carousel only includes successfully rendered diagrams.
 */
export type MermaidRegistry = {
  register: (offset: number) => void;
  unregister: (offset: number) => void;
};

export const MermaidRegistryContext = createContext<MermaidRegistry>({
  register: () => {},
  unregister: () => {},
});

// ============================================================================
// Definitions context
// ============================================================================

/**
 * Resolved definition data (url + optional title) keyed by identifier.
 */
export type Definitions = Map<string, { url: string; title?: string | null }>;

/**
 * Context that provides a definitions lookup function to LinkReferenceNode and
 * ImageReferenceNode without prop-drilling. Stored as an accessor for reactivity.
 */
export const DefinitionsContext = createContext<() => Definitions>(() => new Map());
