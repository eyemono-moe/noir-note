import { describe, expect, test } from "vite-plus/test";

// oxlint-disable-next-line import/no-unresolved, import/default
import source from "./AttachmentsTab.tsx?raw";

describe("AttachmentsTab delete confirmation dialog", () => {
  test("renders the alert dialog through a Portal so it is not constrained by the virtualized row", () => {
    const dialogStart = source.indexOf("{/* Delete confirmation dialog");
    const dialogRoot = source.indexOf("<Dialog.Root", dialogStart);
    const dialogEnd = source.indexOf("</Dialog.Root>", dialogRoot);
    const portalStart = source.lastIndexOf("<Portal>", dialogRoot);
    const portalEnd = source.indexOf("</Portal>", dialogEnd);

    expect(dialogStart).toBeGreaterThanOrEqual(0);
    expect(dialogRoot).toBeGreaterThan(dialogStart);
    expect(dialogEnd).toBeGreaterThan(dialogRoot);
    expect(portalStart).toBeGreaterThan(dialogStart);
    expect(portalStart).toBeLessThan(dialogRoot);
    expect(portalEnd).toBeGreaterThan(dialogEnd);
  });
});
