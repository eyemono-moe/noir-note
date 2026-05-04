import type { EmbedInfo, EmbedMatcher } from "../types";

export const soundcloudMatcher: EmbedMatcher = {
  id: "soundcloud",
  name: "SoundCloud",
  match: (url): EmbedInfo | null => {
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, "");

      if (host === "soundcloud.com") {
        // Require at least /user/track or /user/sets/playlist
        const parts = u.pathname.split("/").filter(Boolean);
        if (parts.length >= 2) {
          const params = new URLSearchParams({
            url,
            color: "%23ff5500",
            auto_play: "false",
            hide_related: "false",
            show_comments: "true",
            show_user: "true",
            show_reposts: "false",
          });

          return {
            matcherId: "soundcloud",
            embedUrl: `https://w.soundcloud.com/player/?${params.toString()}`,
            height: "165px",
            type: "iframe",
          };
        }
      }
    } catch {
      return null;
    }

    return null;
  },
};
