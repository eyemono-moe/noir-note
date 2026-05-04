import { niconicoMatcher } from "./matchers/niconico";
import { soundcloudMatcher } from "./matchers/soundcloud";
import { spotifyMatcher } from "./matchers/spotify";
import { twitterMatcher } from "./matchers/twitter";
import { youtubeMatcher } from "./matchers/youtube";
import type { EmbedInfo, EmbedMatcher } from "./types";
export { EmbedRenderer } from "./EmbedRenderer";

export type { EmbedInfo, EmbedMatcher };

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
