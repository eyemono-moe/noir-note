/**
 * Performance tests for the eyemono.md app with a large note set.
 *
 * Each test seeds NOTE_COUNT notes directly into OPFS (bypassing the app's
 * worker) so the app starts cold with a realistic "power user" collection.
 *
 * Run in isolation (they are slow):
 *   vp run test:e2e -- --project=chromium e2e/performance.e2e.ts
 *
 * Thresholds are intentionally generous to tolerate CI variance.
 * Their purpose is to catch regressions, not to define ideal targets.
 */

import { expect, test, type Page, type TestInfo } from "@playwright/test";

// ── Configuration ─────────────────────────────────────────────────────────────

const NOTE_COUNT = 1_000;

/** Must match MAX_PALETTE_ITEMS in src/commands/palette.tsx. */
const MAX_PALETTE_ITEMS = 50;

/**
 * Upper-bound time budgets (ms).
 * A test fails when the measured value exceeds its threshold.
 */
const THRESHOLDS = {
  /** Reload → interactive editor, while the OPFS worker reads all notes. */
  initialLoadMs: 8_000,
  /** SPA navigation between notes (sidebar click, no reload). */
  noteSwitchMs: 500,
  /** Typing a query in the command palette until the first result appears. */
  commandPaletteMs: 1_000,
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function waitForEditor(page: Page) {
  await page.locator(".cm-content[contenteditable='true']").waitFor({ timeout: 15_000 });
}

/**
 * Write `count` notes directly into the browser's OPFS, bypassing the app's
 * worker. Files are written concurrently in batches to maximise throughput.
 * Returns the elapsed time in milliseconds.
 *
 * The encoding logic mirrors `noteStore.ts:encodeNoteId` and must stay in sync.
 */
async function seedNotes(page: Page, count: number): Promise<number> {
  return page.evaluate(async (count: number) => {
    function encodeNoteId(path: string): string {
      const bytes = new TextEncoder().encode(path);
      let binary = "";
      for (const b of bytes) binary += String.fromCharCode(b);
      return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    }

    const BATCH_SIZE = 50;
    const start = performance.now();
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle("notes", { create: true });

    for (let base = 0; base < count; base += BATCH_SIZE) {
      const end = Math.min(base + BATCH_SIZE, count);
      await Promise.all(
        Array.from({ length: end - base }, async (_, i) => {
          const idx = base + i;
          const path = `/perf-note-${idx}`;
          const doc = JSON.stringify({
            path,
            content: `# Perf Note ${idx}\n\nThis is performance test note ${idx}.`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          const fh = await dir.getFileHandle(`${encodeNoteId(path)}.json`, { create: true });
          const w = await fh.createWritable();
          await w.write(doc);
          await w.close();
        }),
      );
    }

    return performance.now() - start;
  }, count);
}

/** Append a named metric to the test report and print it to stdout. */
function recordMetric(info: TestInfo, name: string, valueMs: number): void {
  info.annotations.push({ type: `metric:${name}`, description: `${valueMs.toFixed(0)}ms` });
  console.log(`  [perf] ${name}: ${valueMs.toFixed(0)}ms`);
}

/**
 * Navigate to "/" in a fresh context, wait for the welcome note, then seed
 * NOTE_COUNT notes. Reports the seed time as a metric.
 */
async function bootstrapWithNotes(page: Page, info: TestInfo): Promise<void> {
  await page.goto("/");
  await waitForEditor(page);

  const seedMs = await seedNotes(page, NOTE_COUNT);
  recordMetric(info, `seed-${NOTE_COUNT}-notes`, seedMs);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe(`Performance: ${NOTE_COUNT} notes @perf`, () => {
  // Long timeout: seeding (~3–8 s) + the measured operation itself.
  test.setTimeout(90_000);

  // ── 1. Initial load ────────────────────────────────────────────────────────
  //
  // Measures the full pipeline: OPFS worker reads 1000 files → TanStack DB
  // populates → SolidJS renders the editor for the current note.

  test(`initial load: editor ready in under ${THRESHOLDS.initialLoadMs}ms`, async ({
    page,
  }, info) => {
    await bootstrapWithNotes(page, info);

    const t0 = Date.now();
    await page.reload();
    await waitForEditor(page);
    const loadMs = Date.now() - t0;

    recordMetric(info, "initial-load", loadMs);
    expect(
      loadMs,
      `Initial load took ${loadMs}ms (budget: ${THRESHOLDS.initialLoadMs}ms)`,
    ).toBeLessThan(THRESHOLDS.initialLoadMs);
  });

  // ── 2. Sidebar renders last item ────────────────────────────────────────────
  //
  // The TreeView has virtual scrolling; only items in the visible viewport
  // are rendered to the DOM. This test checks whether the expected number of items
  // are rendered at scale, and that the last item can be scrolled into view.

  test(`sidebar: all ${NOTE_COUNT} leaf nodes visible in the tree`, async ({ page }, info) => {
    await bootstrapWithNotes(page, info);
    await page.reload();
    await waitForEditor(page);

    // Scroll to the last item and wait for it to render. This tests the virtual scrolling logic,
    // which should render the last item within a reasonable time even with 1000 notes in the collection.
    // If the virtual scrolling logic is broken and tries to render all items at once,
    // this will fail or take a very long time.
    await page.locator('[data-part="tree"]').focus();
    await page.keyboard.press("End");

    const lastItemLocator = page.locator(
      `[data-value="/perf-note-${NOTE_COUNT - 1}"][data-part="trigger"][data-scope="hover-card"]`,
    );
    const t0 = Date.now();
    await lastItemLocator.waitFor({ timeout: 15_000 });
    const sidebarMs = Date.now() - t0;

    // Count the number of rendered items to verify virtual scrolling is working.
    const treeItemCount = await page
      .locator('[data-part="tree"] [data-value^="/perf-note-"]')
      .count();

    recordMetric(info, "sidebar-render-last-item", sidebarMs);
    info.annotations.push({
      type: "metric:sidebar-rendered-item-count",
      description: String(treeItemCount),
    });
    console.log(`  [perf] sidebar-rendered-item-count: ${treeItemCount}`);

    expect(
      sidebarMs,
      `Sidebar took ${sidebarMs}ms to render the last item (budget: 15,000ms)`,
    ).toBeLessThan(15_000);
    expect(treeItemCount).toBeGreaterThan(0);
    // With 1000 notes, the full list should never render — that would freeze the UI.
    expect(treeItemCount).toBeLessThan(NOTE_COUNT);
  });

  // ── 3. Note switch ─────────────────────────────────────────────────────────
  //
  // Uses SPA navigation (sidebar click) to measure the real in-app experience.
  // page.goto() causes a full reload (including OPFS re-read) and would inflate
  // this number by ~2 s — not representative of normal use.

  test(`note switch: under ${THRESHOLDS.noteSwitchMs}ms with ${NOTE_COUNT} notes loaded`, async ({
    page,
  }, info) => {
    await bootstrapWithNotes(page, info);
    await page.reload();
    await waitForEditor(page);

    // Navigate to a seeded note via sidebar click so TanStack DB is warmed up.
    const item0 = page.locator(
      '[data-value="/perf-note-0"][data-part="trigger"][data-scope="hover-card"]',
    );
    await item0.click();
    await page.waitForURL("**/perf-note-0", { timeout: 5_000 });
    await waitForEditor(page);

    // Measure SPA navigation to an adjacent note.
    const item1 = page.locator(
      '[data-value="/perf-note-1"][data-part="trigger"][data-scope="hover-card"]',
    );
    const t0 = Date.now();
    await item1.click();
    await page.waitForURL("**/perf-note-1", { timeout: 5_000 });
    await waitForEditor(page);
    const switchMs = Date.now() - t0;

    recordMetric(info, "note-switch-spa", switchMs);
    expect(
      switchMs,
      `SPA note switch took ${switchMs}ms (budget: ${THRESHOLDS.noteSwitchMs}ms)`,
    ).toBeLessThan(THRESHOLDS.noteSwitchMs);
  });

  // ── 4. Command palette search ──────────────────────────────────────────────
  //
  // The palette renders at most MAX_PALETTE_ITEMS options at a time. This test
  // verifies both the responsiveness and the cap on rendered DOM nodes.

  test(`command palette: first result under ${THRESHOLDS.commandPaletteMs}ms, results capped at ${MAX_PALETTE_ITEMS}`, async ({
    page,
  }, info) => {
    await bootstrapWithNotes(page, info);
    await page.reload();
    await waitForEditor(page);

    await page.keyboard.press("Control+k");
    await page.locator('[role="combobox"]').waitFor({ timeout: 5_000 });

    const t0 = Date.now();
    await page.keyboard.type("perf-note");
    await page.locator('[role="option"]').first().waitFor({ timeout: 5_000 });
    const searchMs = Date.now() - t0;

    const resultCount = await page.locator('[role="option"]').count();

    recordMetric(info, "command-palette-search", searchMs);
    info.annotations.push({
      type: "metric:palette-result-count",
      description: String(resultCount),
    });
    console.log(`  [perf] palette-result-count: ${resultCount}`);

    expect(
      searchMs,
      `Command palette search took ${searchMs}ms (budget: ${THRESHOLDS.commandPaletteMs}ms)`,
    ).toBeLessThan(THRESHOLDS.commandPaletteMs);
    expect(resultCount).toBeGreaterThan(0);
    // Results must be capped — rendering all 1000 matches freezes the UI.
    expect(resultCount).toBeLessThanOrEqual(MAX_PALETTE_ITEMS);
  });
});
