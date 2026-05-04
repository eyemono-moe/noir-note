import type { EmbedInfo, EmbedMatcher } from "../types";

export const twitterMatcher: EmbedMatcher = {
  id: "twitter",
  name: "Twitter / X",
  match: (url): EmbedInfo | null => {
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, "");

      if (
        (host === "twitter.com" || host === "x.com") &&
        /^\/[^/]+\/status\/\d+/.test(u.pathname)
      ) {
        return {
          matcherId: "twitter",
          // The original tweet URL is passed to twttr.widgets.createTweet
          embedUrl: url,
          type: "twitter",
        };
      }
    } catch {
      return null;
    }

    return null;
  },
};
