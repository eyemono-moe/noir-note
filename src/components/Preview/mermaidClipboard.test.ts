import { describe, expect, test, vi } from "vite-plus/test";

import { copyMermaidPngToClipboard, copyMermaidSvgToClipboard } from "./mermaidClipboard";

describe("mermaidClipboard", () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="5"><text>Hi</text></svg>';

  test("copies Mermaid SVG source text when text clipboard write is available", async () => {
    const write = vi.fn<(items: ClipboardItem[]) => Promise<void>>(async () => {});
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
    expect(write).not.toHaveBeenCalled();
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

  test("removes Mermaid HTML labels before PNG rasterization to avoid tainted canvas", async () => {
    const htmlLabelSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="5">
      <foreignObject><div xmlns="http://www.w3.org/1999/xhtml">HTML label</div></foreignObject>
      <text>Fallback label</text>
    </svg>`;
    const pngBlob = new Blob(["png"], { type: "image/png" });
    const write = vi.fn<(items: ClipboardItem[]) => Promise<void>>(async () => {});
    class MockClipboardItem {
      constructor(_items: Record<string, Blob>) {}
    }
    const rasterizeSvgToPng = vi.fn<(input: string) => Promise<Blob>>(async () => pngBlob);

    await copyMermaidPngToClipboard(htmlLabelSvg, {
      clipboard: { write },
      ClipboardItem: MockClipboardItem as unknown as typeof ClipboardItem,
      rasterizeSvgToPng,
    });

    const rasterizedSvg = rasterizeSvgToPng.mock.calls[0]?.[0];
    expect(rasterizedSvg).toContain("Fallback label");
    expect(rasterizedSvg).not.toContain("foreignObject");
    expect(rasterizedSvg).not.toContain("HTML label");
  });
});
