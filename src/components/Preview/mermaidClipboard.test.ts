import { describe, expect, test, vi } from "vite-plus/test";

import { copyMermaidPngToClipboard, copyMermaidSvgToClipboard } from "./mermaidClipboard";

describe("mermaidClipboard", () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="5"><text>Hi</text></svg>';

  test("copies Mermaid SVG as an image ClipboardItem when supported", async () => {
    const write = vi.fn<(items: ClipboardItem[]) => Promise<void>>(async () => {});
    const clipboardItemPayloads: Record<string, Blob>[] = [];
    class MockClipboardItem {
      constructor(items: Record<string, Blob>) {
        clipboardItemPayloads.push(items);
      }
    }

    const result = await copyMermaidSvgToClipboard(svg, {
      clipboard: { write },
      ClipboardItem: MockClipboardItem as unknown as typeof ClipboardItem,
    });

    expect(result).toEqual({ kind: "svg-image" });
    expect(clipboardItemPayloads).toHaveLength(1);
    const payload = clipboardItemPayloads[0];
    expect(payload?.["image/svg+xml"]).toBeInstanceOf(Blob);
    expect(payload?.["image/svg+xml"]?.type).toBe("image/svg+xml");
    expect(write).toHaveBeenCalledOnce();
  });

  test("falls back to writing SVG text when image clipboard write is unavailable", async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(async () => {});

    const result = await copyMermaidSvgToClipboard(svg, {
      clipboard: { writeText },
    });

    expect(result).toEqual({ kind: "svg-text" });
    expect(writeText).toHaveBeenCalledWith(svg);
  });

  test("falls back to writing SVG text when image clipboard write rejects", async () => {
    const write = vi.fn<(items: ClipboardItem[]) => Promise<void>>(async () => {
      throw new Error("unsupported MIME type");
    });
    const writeText = vi.fn<(text: string) => Promise<void>>(async () => {});
    class MockClipboardItem {
      constructor(_items: Record<string, Blob>) {}
    }

    const result = await copyMermaidSvgToClipboard(svg, {
      clipboard: { write, writeText },
      ClipboardItem: MockClipboardItem as unknown as typeof ClipboardItem,
    });

    expect(result).toEqual({ kind: "svg-text" });
    expect(writeText).toHaveBeenCalledWith(svg);
  });

  test("copies Mermaid SVG as PNG through injected rasterization", async () => {
    const pngBlob = new Blob(["png"], { type: "image/png" });
    const write = vi.fn<(items: ClipboardItem[]) => Promise<void>>(async () => {});
    const clipboardItemPayloads: Record<string, Blob>[] = [];
    class MockClipboardItem {
      constructor(items: Record<string, Blob>) {
        clipboardItemPayloads.push(items);
      }
    }
    const rasterizeSvgToPng = vi.fn<(input: string) => Promise<Blob>>(async () => pngBlob);

    await copyMermaidPngToClipboard(svg, {
      clipboard: { write },
      ClipboardItem: MockClipboardItem as unknown as typeof ClipboardItem,
      rasterizeSvgToPng,
    });

    expect(rasterizeSvgToPng).toHaveBeenCalledWith(svg);
    expect(clipboardItemPayloads).toEqual([{ "image/png": pngBlob }]);
    expect(write).toHaveBeenCalledOnce();
  });
});
