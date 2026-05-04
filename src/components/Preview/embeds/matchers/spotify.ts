import type { EmbedInfo, EmbedMatcher } from "../types";

export const spotifyMatcher: EmbedMatcher = {
  id: "spotify",
  name: "Spotify",
  match: (url): EmbedInfo | null => {
    try {
      const u = new URL(url);

      if (u.hostname === "open.spotify.com") {
        // Spotify paths may include an optional locale segment before the type
        // e.g. /intl-ja/artist/ID  or  /track/ID
        const m = u.pathname.match(
          /^\/(?:[^/]+\/)?(track|album|playlist|artist|episode|show)\/([^/?]+)/,
        );
        if (m) {
          const [, type, id] = m;
          // Tracks and episodes use a compact player; albums/playlists/shows use a taller one
          const isTall = type === "album" || type === "playlist" || type === "artist";

          return {
            matcherId: "spotify",
            embedUrl: `https://open.spotify.com/embed/${type}/${id}?utm_source=generator`,
            height: isTall ? "380px" : "152px",
            allow: "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture",
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
