/**
 * Shared OPFS sync helper for TanStack DB collections.
 *
 * Extracts the common pattern used by OPFS-backed collections:
 *   1. Subscribe to a BroadcastChannel (before the async enumerate to avoid
 *      losing events that arrive during the initial load)
 *   2. Enumerate all items from OPFS and write them to the TanStack DB store
 *   3. Flush buffered channel events that arrived during the enumerate
 *   4. Call markReady() so the UI can render
 *
 * Returns a TanStack DB `SyncConfig["sync"]` function ready to drop into a
 * collection's `sync` option.
 */

import type { ChangeMessageOrDeleteKeyMessage, SyncConfig } from "@tanstack/solid-db";

/**
 * Create a sync function that loads items from `listFn` on startup and
 * keeps the collection live via a BroadcastChannel.
 *
 * @param channelId  Unique BroadcastChannel name for this collection.
 * @param listFn     Async function that returns the initial set of items.
 */
export function createOpfsBroadcastSync<T extends object, K extends string | number = string>(
  channelId: string,
  listFn: () => Promise<T[]>,
): SyncConfig<T, K>["sync"] {
  return ({ begin, write, commit, markReady }) => {
    type Msg = ChangeMessageOrDeleteKeyMessage<T, K>;

    let initialSyncComplete = false;
    const eventBuffer: Msg[] = [];

    // Subscribe BEFORE the async list call so events aren't lost.
    const channel = new BroadcastChannel(channelId);
    channel.onmessage = (evt: MessageEvent<Msg>) => {
      if (!initialSyncComplete) {
        eventBuffer.push(evt.data);
        return;
      }
      begin({ immediate: true });
      write(evt.data);
      commit();
    };

    void (async () => {
      try {
        const items = await listFn();
        begin();
        for (const item of items) {
          write({ type: "insert", value: item });
        }
        commit();

        // Flush events that arrived while the initial fetch was in flight.
        initialSyncComplete = true;
        if (eventBuffer.length > 0) {
          begin();
          for (const msg of eventBuffer) write(msg);
          commit();
          eventBuffer.splice(0);
        }
      } catch (err) {
        console.error(`[opfsSync:${channelId}] Initial sync failed:`, err);
        // Set flag so the buffer doesn't grow unboundedly.
        initialSyncComplete = true;
      } finally {
        // Always mark ready so the UI doesn't stay in a loading state.
        markReady();
      }
    })();

    return () => channel.close();
  };
}
