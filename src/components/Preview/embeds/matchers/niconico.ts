import type { EmbedInfo, EmbedMatcher } from "../types";

// Supported video ID prefixes: sm (standard), nm (user-uploaded), so (channel)
const VIDEO_ID_RE = /(?:sm|nm|so)\d+/;

export const niconicoMatcher: EmbedMatcher = {
  id: "niconico",
  name: "ニコニコ動画",
  match: (url): EmbedInfo | null => {
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, "");
      let videoId: string | null = null;

      if (host === "nicovideo.jp") {
        const m = u.pathname.match(new RegExp(`^/watch/(${VIDEO_ID_RE.source})`));
        if (m) videoId = m[1];
      } else if (host === "nico.ms") {
        const m = u.pathname.match(new RegExp(`^/(${VIDEO_ID_RE.source})`));
        if (m) videoId = m[1];
      }

      if (!videoId) return null;

      return {
        matcherId: "niconico",
        embedUrl: `https://embed.nicovideo.jp/watch/${videoId}?persistence=1`,
        aspectRatio: "16/9",
        allow: "autoplay; fullscreen",
        type: "iframe",
      };
    } catch {
      return null;
    }
  },
};
