export interface EmbedMatcher {
  /** Unique service identifier, used as config key */
  id: string;
  /** Human-readable name shown in settings UI */
  name: string;
  /** Returns embed info if the URL matches this service, otherwise null */
  match: (url: string) => EmbedInfo | null;
}

export interface EmbedInfo {
  /** Matches the EmbedMatcher.id that produced this info */
  matcherId: string;
  /** URL to load in the iframe (or the original tweet URL for Twitter) */
  embedUrl: string;
  /**
   * CSS aspect-ratio value (e.g. "16/9").
   * Used when height is not specified.
   */
  aspectRatio?: string;
  /**
   * Fixed CSS height value (e.g. "152px").
   * Takes precedence over aspectRatio when set.
   */
  height?: string;
  /** Value for the <iframe allow="..."> attribute */
  allow?: string;
  type: "iframe" | "twitter";
}
