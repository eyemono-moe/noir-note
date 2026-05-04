/**
 * E2E scenario tests for the eyemono.md memo app.
 *
 * Each test runs in a fresh browser context, so OPFS is always empty at
 * start.  On first load the app seeds a welcome note at path "/".
 *
 * Navigation strategy:
 *   - page.goto()            – full page reload; used when testing OPFS
 *                              persistence across reloads.
 *   - click tree-item        – same-session SPA navigation; used when
 *                              testing editor-state behaviour (undo leak, etc.)
 *
 * Selectors:
 *   - `.cm-content`          – CodeMirror's contenteditable editor surface
 *   - `[data-value="<path>]` – Ark UI TreeView item for a specific note path
 */

import { expect, test, type Page } from "@playwright/test";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Wait for CodeMirror to be mounted and interactive. */
async function waitForEditor(page: Page) {
  await page.locator(".cm-content[contenteditable='true']").waitFor({ timeout: 10_000 });
}

/** Click inside the editor and type text. */
async function typeInEditor(page: Page, text: string) {
  await page.locator(".cm-content").click();
  await page.keyboard.type(text);
}

/**
 * Get the plain-text content currently displayed in the editor.
 * Uses innerText so whitespace / newlines are preserved naturally.
 */
async function getEditorText(page: Page): Promise<string> {
  return page.locator(".cm-content").innerText();
}

/**
 * Hover a sidebar tree item's clickable control so that the action
 * buttons become visible.
 *
 * Multiple elements share `data-value` on the same path (TreeView branch,
 * HoverCard trigger, BranchContent, Combobox option).  We narrow to the
 * HoverCard trigger that wraps the BranchControl — it is the interactive
 * surface that shows the Add/Delete buttons on hover.
 */
async function hoverTreeItem(page: Page, path: string) {
  const item = page.locator(`[data-value="${path}"][data-part="trigger"][data-scope="hover-card"]`);
  await item.waitFor({ timeout: 5_000 });
  await item.hover();
  return item;
}

/**
 * Navigate to a note within the same SPA session by clicking its sidebar
 * tree item.  Avoids a full page reload so editor state is preserved.
 */
async function navigateViaSidebar(page: Page, path: string) {
  const item = page.locator(`[data-value="${path}"][data-part="trigger"][data-scope="hover-card"]`);
  await item.click();
  // Wait for the URL to reflect the new path.
  await page.waitForURL(`**${path}`, { timeout: 5_000 });
  await waitForEditor(page);
}

/**
 * AUTO_SAVE_DELAY (500 ms) + a small buffer to guarantee the debounced
 * OPFS write has completed before the test reads data back.
 */
const SAVE_SETTLE_MS = 900;

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe.configure({ mode: "parallel" });

test.describe("Memo app", () => {
  // ── 1. Open root note ──────────────────────────────────────────────────────

  test("can open the root note", async ({ page }) => {
    await page.goto("/");
    await waitForEditor(page);

    // The app seeds a welcome note at "/" when OPFS is empty.
    await expect(page.locator(".cm-content")).toContainText("Welcome");
  });

  // ── 2. Edit a note ─────────────────────────────────────────────────────────

  test("can edit a note", async ({ page }) => {
    // Navigate to a fresh path (no note there yet → empty editor).
    await page.goto("/edit-test");
    await waitForEditor(page);

    const typed = "Hello from Playwright!";
    await typeInEditor(page, typed);

    await expect(page.locator(".cm-content")).toContainText(typed);
  });

  // ── 3. Content restored when reopening ────────────────────────────────────

  test("note content is restored when reopened after a reload", async ({ page }) => {
    const content = "Persistent content — should survive reload";

    // Write to a fresh note and wait for the OPFS save to complete.
    await page.goto("/persist-test");
    await waitForEditor(page);
    await typeInEditor(page, content);
    await page.waitForTimeout(SAVE_SETTLE_MS);

    // Navigate away (full reload to a different note).
    await page.goto("/");
    await waitForEditor(page);

    // Navigate back (another full reload).
    await page.goto("/persist-test");
    await waitForEditor(page);

    await expect(page.locator(".cm-content")).toContainText(content);
  });

  // ── 4. Editor content changes on navigation ───────────────────────────────

  test("editor content changes when navigating between notes", async ({ page }) => {
    // Open welcome note — has non-empty content.
    await page.goto("/");
    await waitForEditor(page);
    const welcomeText = await getEditorText(page);
    expect(welcomeText.trim().length).toBeGreaterThan(0);

    // Create a child note via the sidebar so we have a second note to navigate to.
    const item = await hoverTreeItem(page, "/");
    await item.getByRole("button", { name: "Add child note" }).click();
    await page.getByPlaceholder("Enter note name...").fill("nav-target");
    await page.keyboard.press("Enter");
    await waitForEditor(page);

    // The new note is empty — content should differ from the welcome note.
    const newText = await getEditorText(page);
    expect(newText.trim()).not.toBe(welcomeText.trim());
    await expect(page.locator(".cm-content")).not.toContainText("Welcome");

    // Navigate back to root via sidebar — welcome content reappears.
    await navigateViaSidebar(page, "/");
    await expect(page.locator(".cm-content")).toContainText("Welcome");
  });

  // ── 5. Create a new note ──────────────────────────────────────────────────

  test("can create a new note via sidebar", async ({ page }) => {
    await page.goto("/");
    await waitForEditor(page);

    // Hover root note → click "Add child note" action.
    const rootItem = await hoverTreeItem(page, "/");
    await rootItem.getByRole("button", { name: "Add child note" }).click();

    // Type note name and confirm with Enter.
    await page.getByPlaceholder("Enter note name...").fill("my-new-note");
    await page.keyboard.press("Enter");

    // App should navigate to the new path.
    await expect(page).toHaveURL(/\/my-new-note/);
    await waitForEditor(page);

    // New note starts empty.
    const text = await getEditorText(page);
    expect(text.trim()).toBe("");

    // Tree item for the new note is visible in the sidebar.
    await expect(
      page.locator('[data-value="/my-new-note"][data-part="trigger"][data-scope="hover-card"]'),
    ).toBeVisible();
  });

  // ── 6. Delete a note ──────────────────────────────────────────────────────

  test("can delete a note", async ({ page }) => {
    await page.goto("/");
    await waitForEditor(page);

    // Create a note to delete.
    const rootItem = await hoverTreeItem(page, "/");
    await rootItem.getByRole("button", { name: "Add child note" }).click();
    await page.getByPlaceholder("Enter note name...").fill("to-delete");
    await page.keyboard.press("Enter");
    await waitForEditor(page);

    // Hover the newly created note and click "Delete note".
    const noteItem = await hoverTreeItem(page, "/to-delete");
    await noteItem.getByRole("button", { name: "Delete note" }).click();

    // Confirm deletion in the dialog (exact match to distinguish from "Delete note" icon button).
    await page.getByRole("button", { name: "Delete", exact: true }).click();

    // The tree item should no longer be visible.
    await expect(
      page.locator('[data-value="/to-delete"][data-part="trigger"][data-scope="hover-card"]'),
    ).not.toBeVisible();
  });

  // ── 7. Undo does not bleed across notes ───────────────────────────
  //
  // Regression test for the bug fixed in fix/file.undo:
  // Undoing in note B must not surface content typed in note A.

  test("undo does not leak content from a previously visited note", async ({ page }) => {
    const contentA = "Content that belongs to note A only";

    // Navigate to note A and type content.
    await page.goto("/undo-note-a");
    await waitForEditor(page);
    await typeInEditor(page, contentA);
    await page.waitForTimeout(SAVE_SETTLE_MS);

    // Create note B via sidebar so we can navigate to it in the same session.
    const sidebarItem = await hoverTreeItem(page, "/undo-note-a");
    await sidebarItem.getByRole("button", { name: "Add child note" }).click();
    await page.getByPlaceholder("Enter note name...").fill("undo-note-b");
    await page.keyboard.press("Enter");
    await waitForEditor(page);

    // Undo in note B — must NOT reveal note A's content.
    await page.locator(".cm-content").click();
    await page.keyboard.press("Control+z");

    await expect(page.locator(".cm-content")).not.toContainText(contentA);
  });

  // ── 8. Undo / Redo work within a single note ─────────────────────

  test("undo and redo work correctly within a single note", async ({ page }) => {
    await page.goto("/undo-redo-test");
    await waitForEditor(page);

    // Type some text.
    await typeInEditor(page, "Step one");
    await expect(page.locator(".cm-content")).toContainText("Step one");

    // Undo removes the typed text.
    await page.keyboard.press("Control+z");
    await expect(page.locator(".cm-content")).not.toContainText("Step one");

    // Redo restores it.
    await page.keyboard.press("Control+y");
    await expect(page.locator(".cm-content")).toContainText("Step one");
  });

  // ── 9. Undo history preserved after A → B → A navigation ─────────
  //
  // Verifies that the EditorState cache (stateCache.save / stateCache.load)
  // correctly restores a note's own undo stack when navigating back to it.
  // Steps: type in A, navigate to B, navigate back to A, undo in A — the
  // typed text must disappear (A's history was preserved), not crash or
  // silently fail.

  test("undo history is preserved when returning to a previously visited note", async ({
    page,
  }) => {
    const contentA = "History must survive the round trip";

    // Navigate to note A and type content.
    await page.goto("/history-note-a");
    await waitForEditor(page);
    await typeInEditor(page, contentA);
    await page.waitForTimeout(SAVE_SETTLE_MS);

    // Verify the content is present.
    await expect(page.locator(".cm-content")).toContainText(contentA);

    // Create note B as a child of A via sidebar, then navigate to it.
    const sidebarItem = await hoverTreeItem(page, "/history-note-a");
    await sidebarItem.getByRole("button", { name: "Add child note" }).click();
    await page.getByPlaceholder("Enter note name...").fill("history-note-b");
    await page.keyboard.press("Enter");
    await waitForEditor(page);

    // We are now in note B (child of A). Navigate back to A via sidebar.
    await navigateViaSidebar(page, "/history-note-a");
    await expect(page.locator(".cm-content")).toContainText(contentA);

    // Undo in note A — must remove A's own typed content.
    await page.locator(".cm-content").click();
    await page.keyboard.press("Control+z");

    await expect(page.locator(".cm-content")).not.toContainText(contentA);
  });
});
