import type { EmbedInfo, EmbedMatcher } from "../types";

export const youtubeMatcher: EmbedMatcher = {
  id: "youtube",
  name: "YouTube",
  match: (url): EmbedInfo | null => {
    let videoId: string | null = null;

    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, "");

      if (host === "youtube.com") {
        if (u.pathname === "/watch") {
          videoId = u.searchParams.get("v");
        } else {
          const m = u.pathname.match(/^\/shorts\/([^/?]+)/);
          if (m) videoId = m[1];
        }
      } else if (host === "youtu.be") {
        const id = u.pathname.slice(1).split("?")[0];
        if (id) videoId = id;
      }
    } catch {
      return null;
    }

    if (!videoId) return null;

    return {
      matcherId: "youtube",
      // Use the privacy-enhanced domain to avoid tracking without consent
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
      aspectRatio: "16/9",
      allow:
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
      type: "iframe",
    };
  },
};
