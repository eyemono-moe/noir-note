/**
 * E2E tests for the Attachments tab.
 *
 * Tests cover: uploading images, persistence across reloads, the
 * "Check refs" popover (both unused and referenced states), and the
 * full workflow of attaching an image to a note so it renders in the preview.
 *
 * Each test runs in a fresh browser context so OPFS is always empty at the start.
 */

import { expect, test, type Page } from "@playwright/test";

// ── Fixtures ──────────────────────────────────────────────────────────────────

/**
 * Minimal 1×1 PNG (69 bytes). Used as a test image fixture to avoid
 * filesystem dependencies.
 */
const MINIMAL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
  "base64",
);

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Navigate to the app root and wait for the editor to be ready. */
async function gotoApp(page: Page, path = "/") {
  await page.goto(path);
  await page.locator(".cm-content[contenteditable='true']").waitFor({ timeout: 10_000 });
}

/** Click the Attachments tab and wait for the upload button to be visible. */
async function openAttachmentsTab(page: Page) {
  await page.getByRole("tab", { name: "Attachments" }).click();
  await page.getByRole("button", { name: "Upload image" }).waitFor({ timeout: 5_000 });
}

/**
 * Upload a test PNG via the file-chooser dialog triggered by the
 * "Upload image" button. Returns after the chooser resolves.
 */
async function uploadTestImage(page: Page, filename = "test-image.png") {
  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: "Upload image" }).click(),
  ]);
  await fileChooser.setFiles({
    name: filename,
    mimeType: "image/png",
    buffer: MINIMAL_PNG,
  });
}

/**
 * Wait for an attachment row with the given filename to appear in the
 * virtual list. Returns the row locator.
 *
 * Scoped to `[data-index]:not([data-scope])` to target only the virtual-list
 * item wrappers. Ark UI Splitter panels also carry `data-index` but always
 * have `data-scope="splitter"`, so `:not([data-scope])` excludes them.
 */
async function waitForAttachmentRow(page: Page, filename: string, timeout = 5_000) {
  const row = page
    .locator("[data-index]:not([data-scope])")
    .filter({ has: page.locator("p", { hasText: filename }) });
  await row.waitFor({ timeout });
  return row;
}

/** AUTO_SAVE_DELAY (500 ms) + buffer to ensure the OPFS write has completed. */
const SAVE_SETTLE_MS = 900;

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe("Attachments tab", () => {
  // ── 1. Upload an image ────────────────────────────────────────────────────

  test("can upload an image and see it in the attachment list", async ({ page }) => {
    await gotoApp(page);
    await openAttachmentsTab(page);

    // Confirm the empty state before upload.
    await expect(page.getByText("No attachments yet")).toBeVisible();

    await uploadTestImage(page, "hello.png");

    // Filename appears in the virtual list row.
    await waitForAttachmentRow(page, "hello.png");

    // Empty-state placeholder is gone.
    await expect(page.getByText("No attachments yet")).not.toBeVisible();
  });

  // ── 2. Persistence across reloads ─────────────────────────────────────────

  test("uploaded attachment persists after a page reload", async ({ page }) => {
    await gotoApp(page);
    await openAttachmentsTab(page);

    await uploadTestImage(page, "persistent.png");
    await waitForAttachmentRow(page, "persistent.png");

    // Reload and reopen the tab.
    await page.reload();
    await page.locator(".cm-content[contenteditable='true']").waitFor({ timeout: 10_000 });
    await openAttachmentsTab(page);

    // Attachment must still be in the list.
    await waitForAttachmentRow(page, "persistent.png");
  });

  // ── 3. "Check refs" shows No references for an unreferenced image ─────────
  //
  // Regression test for the Suspense bug: clicking the "Check refs" trigger
  // previously caused `createResource` (refs) to start loading without an
  // initialValue, which triggered the <Suspense> wrapping <Sidebar> and
  // remounted the entire sidebar — so the popover never opened.

  test("Check refs popover opens and shows No references for an unused image", async ({ page }) => {
    await gotoApp(page);
    await openAttachmentsTab(page);

    await uploadTestImage(page, "unused.png");
    await waitForAttachmentRow(page, "unused.png");

    const trigger = page.locator('[data-scope="popover"][data-part="trigger"]').first();
    await expect(trigger).toBeVisible();
    await trigger.click();

    // If the sidebar had remounted (old Suspense bug), the trigger's component
    // would have been destroyed and the popover would never open.
    await expect(page.getByText("No references")).toBeVisible({ timeout: 5_000 });
  });

  // ── 4. Attach image to a note ─────────────────────────────────────────────
  //
  // Full workflow:
  //   1. Upload image → retrieve the attachment ID from the row's <p title>.
  //   2. Insert a markdown reference into the note via the editor.
  //   3. Verify the image renders in the preview (.markdown-body img).
  //      The Preview resolves `attachment://` URLs to blob URLs via OPFS; the
  //      <img> is only mounted once the blob URL is ready.
  //   4. After the auto-save settles, open "Check refs" → the popover should
  //      list the current note path (ref count = 1).

  test("can attach image to a note and see it in the preview and in Check refs", async ({
    page,
  }) => {
    await gotoApp(page, "/attach-ref-test");
    await openAttachmentsTab(page);

    await uploadTestImage(page, "diagram.png");
    const row = await waitForAttachmentRow(page, "diagram.png");

    // Read the full attachment ID (uuid-diagram.png) from the <p title> attribute.
    const attachmentId = await row.locator("p").getAttribute("title");
    expect(attachmentId).toMatch(/^[0-9a-f-]+-diagram\.png$/i);

    // Insert the markdown image reference into the note editor.
    // The editor and preview panels are always visible alongside the sidebar.
    await page.locator(".cm-content").click();
    await page.keyboard.type(`![diagram](attachment://${attachmentId})`);

    // The Preview resolves `attachment://` URLs to object URLs via OPFS.
    // The <img> is only added to the DOM once the blob URL is ready, so
    // waiting for it to be visible implicitly validates the full resolution chain.
    await expect(page.locator(".markdown-body img")).toBeVisible({ timeout: 10_000 });

    // Wait for the auto-save debounce so the note is written to OPFS.
    await page.waitForTimeout(SAVE_SETTLE_MS);

    // Open "Check refs" for the uploaded image.
    // The Attachments tab is still active — no tab switch needed.
    const trigger = page.locator('[data-scope="popover"][data-part="trigger"]').first();
    await trigger.click();

    // The popover should list the current note path, confirming ref count = 1.
    const popover = page.locator('[data-scope="popover"][data-part="content"]');
    await expect(popover).toContainText("/attach-ref-test", { timeout: 5_000 });
  });
});
