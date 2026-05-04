import type { Component } from "solid-js";
import { Show, createEffect, onCleanup } from "solid-js";

import { useTheme } from "../../../context/theme";
import type { EmbedInfo } from "./types";

// ─── Twitter widget.js singleton loader ──────────────────────────────────────
//
// The script is loaded at most once per page lifetime, regardless of how many
// Twitter embeds are rendered. Components register a callback that fires
// immediately if the script is already loaded, or after it finishes loading.

declare global {
  interface Window {
    twttr?: {
      widgets: {
        createTweet: (
          tweetId: string,
          container: HTMLElement,
          /** @see https://docs.x.com/x-for-websites/embedded-posts/guides/embedded-tweet-parameter-reference */
          options?: Record<string, unknown>,
        ) => Promise<HTMLElement | undefined>;
      };
    };
  }
}

type ScriptState = "idle" | "loading" | "loaded";

let twitterScriptState: ScriptState = "idle";
const twitterReadyCallbacks: Array<() => void> = [];

/**
 * Registers a callback to run when Twitter's widget.js is ready. If the script is already loaded, the callback runs immediately. Otherwise, the callback is queued and will run once the script finishes loading. The script is only loaded once per page lifetime, even if this function is called multiple times.
 * @param cb - The callback function to execute when widget.js is ready.
 * @returns void
 *
 * @see https://docs.x.com/x-for-websites/javascript-api/guides/set-up-x-for-websites
 */
function onTwitterReady(cb: () => void): void {
  if (twitterScriptState === "loaded") {
    cb();
    return;
  }
  twitterReadyCallbacks.push(cb);
  if (twitterScriptState === "loading") return;

  twitterScriptState = "loading";
  const script = document.createElement("script");
  script.src = "https://platform.x.com/widgets.js";
  script.async = true;
  script.charset = "utf-8";
  script.onload = () => {
    twitterScriptState = "loaded";
    for (const fn of twitterReadyCallbacks) fn();
    twitterReadyCallbacks.length = 0;
  };
  document.head.appendChild(script);
}

// ─── Twitter embed component ─────────────────────────────────────────────────

function getTweetId(url: string): string | null {
  const m = url.match(/\/status\/(\d+)/);
  return m ? m[1] : null;
}

const TwitterEmbed: Component<{ url: string; sourceLine: number | undefined }> = (props) => {
  // Use a callback ref so the linter recognizes the assignment
  let containerEl: HTMLDivElement | undefined;
  const isDark = useTheme();

  createEffect(() => {
    const container = containerEl;
    if (!container) return;

    const tweetId = getTweetId(props.url);
    if (!tweetId) return;

    const theme = isDark() ? "dark" : "light";

    onTwitterReady(() => {
      void window.twttr?.widgets.createTweet(tweetId, container, {
        align: "center",
        dnt: true,
        theme,
      });
    });

    onCleanup(() => {
      container.innerHTML = "";
    });
  });

  return (
    <div
      ref={(el) => {
        containerEl = el;
      }}
      data-source-line={props.sourceLine}
      class="children:my-0! mb-4 overflow-hidden rounded-xl"
    />
  );
};

// ─── IframeEmbed component ────────────────────────────────────────────────────

const IframeEmbed: Component<{ info: EmbedInfo; sourceLine: number | undefined }> = (props) => {
  const style = () =>
    props.info.height
      ? { height: props.info.height, width: "100%" }
      : { "aspect-ratio": props.info.aspectRatio };

  return (
    <div
      data-source-line={props.sourceLine}
      class="mb-4 w-full overflow-hidden rounded-xl"
      style={style()}
    >
      <iframe
        title={`Embedded content from ${props.info.matcherId}`}
        src={props.info.embedUrl}
        class="h-full w-full border-0"
        loading="lazy"
        allow={props.info.allow}
        allowfullscreen
      />
    </div>
  );
};

// ─── EmbedRenderer ───────────────────────────────────────────────────────────

export const EmbedRenderer: Component<{
  info: EmbedInfo;
  sourceLine: number | undefined;
}> = (props) => {
  return (
    <Show
      when={props.info.type === "twitter"}
      fallback={<IframeEmbed info={props.info} sourceLine={props.sourceLine} />}
    >
      <TwitterEmbed url={props.info.embedUrl} sourceLine={props.sourceLine} />
    </Show>
  );
};
