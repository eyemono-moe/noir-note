import type { EmbedConfig } from "../../../store/configStore";
import { niconicoMatcher } from "./matchers/niconico";
import { soundcloudMatcher } from "./matchers/soundcloud";
import { spotifyMatcher } from "./matchers/spotify";
import { twitterMatcher } from "./matchers/twitter";
import { youtubeMatcher } from "./matchers/youtube";
import type { EmbedInfo, EmbedMatcher } from "./types";
export { EmbedRenderer } from "./EmbedRenderer";

/**
 * Ordered list of all supported embed services.
 * To add a new service: create a matcher in ./matchers/ and append it here.
 * To remove a service: remove it from this array.
 */
export const EMBED_MATCHERS: EmbedMatcher[] = [
  youtubeMatcher,
  twitterMatcher,
  spotifyMatcher,
  soundcloudMatcher,
  niconicoMatcher,
];

/**
 * Returns EmbedInfo if `url` matches an enabled embed service, otherwise null.
 * Checks the global switch first, then the per-service switch.
 * Per-service defaults to enabled when not explicitly set.
 */
export function detectEmbed(url: string, config: EmbedConfig): EmbedInfo | null {
  if (!config.global) return null;

  for (const matcher of EMBED_MATCHERS) {
    const serviceEnabled = config.services[matcher.id] ?? true;
    if (!serviceEnabled) continue;

    const info = matcher.match(url);
    if (info) return info;
  }

  return null;
}
