type ClipboardLike = {
  write?: (items: ClipboardItem[]) => Promise<void>;
  writeText?: (text: string) => Promise<void>;
};

type ClipboardItemConstructor = new (items: Record<string, Blob>) => ClipboardItem;

type SvgCopyResult = { kind: "svg-image" } | { kind: "svg-text" };

type CopyDependencies = {
  clipboard?: ClipboardLike;
  ClipboardItem?: ClipboardItemConstructor;
};

type PngCopyDependencies = CopyDependencies & {
  rasterizeSvgToPng?: (svg: string) => Promise<Blob>;
};

function getClipboard(): ClipboardLike | undefined {
  return globalThis.navigator?.clipboard;
}

function getClipboardItem(): ClipboardItemConstructor | undefined {
  return globalThis.ClipboardItem;
}

function createSvgBlob(svg: string): Blob {
  return new Blob([svg], { type: "image/svg+xml" });
}

export async function copyMermaidSvgToClipboard(
  svg: string,
  dependencies: CopyDependencies = {},
): Promise<SvgCopyResult> {
  const clipboard = dependencies.clipboard ?? getClipboard();
  const ClipboardItemCtor = dependencies.ClipboardItem ?? getClipboardItem();

  if (clipboard?.writeText) {
    await clipboard.writeText(svg);
    return { kind: "svg-text" };
  }

  if (clipboard?.write && ClipboardItemCtor) {
    await clipboard.write([new ClipboardItemCtor({ "image/svg+xml": createSvgBlob(svg) })]);
    return { kind: "svg-image" };
  }

  throw new Error("Clipboard write is not supported in this browser.");
}

export async function copyMermaidPngToClipboard(
  svg: string,
  dependencies: PngCopyDependencies = {},
): Promise<void> {
  const clipboard = dependencies.clipboard ?? getClipboard();
  const ClipboardItemCtor = dependencies.ClipboardItem ?? getClipboardItem();

  if (!clipboard?.write || !ClipboardItemCtor) {
    throw new Error("PNG clipboard write is not supported in this browser.");
  }

  const png = await (dependencies.rasterizeSvgToPng ?? rasterizeSvgToPng)(sanitizeSvgForPng(svg));
  await clipboard.write([new ClipboardItemCtor({ "image/png": png })]);
}

function sanitizeSvgForPng(svg: string): string {
  const Parser = globalThis.DOMParser;
  const Serializer = globalThis.XMLSerializer;
  if (!Parser || !Serializer) return svg.replace(/<foreignObject\b[\s\S]*?<\/foreignObject>/gi, "");

  const document = new Parser().parseFromString(svg, "image/svg+xml");
  const parseError = document.querySelector("parsererror");
  if (parseError) return svg.replace(/<foreignObject\b[\s\S]*?<\/foreignObject>/gi, "");

  for (const node of Array.from(document.querySelectorAll("foreignObject"))) {
    node.remove();
  }

  for (const image of Array.from(document.querySelectorAll("image"))) {
    const href = image.getAttribute("href") ?? image.getAttribute("xlink:href");
    if (href && !href.startsWith("data:") && !href.startsWith("blob:")) {
      image.remove();
    }
  }

  return new Serializer().serializeToString(document.documentElement);
}

async function rasterizeSvgToPng(svg: string): Promise<Blob> {
  const svgBlob = createSvgBlob(svg);
  const objectUrl = URL.createObjectURL(svgBlob);

  try {
    const image = new Image();
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Failed to load Mermaid SVG for PNG conversion."));
    });
    image.src = objectUrl;
    await loaded;

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas 2D context is not available.");
    }

    context.drawImage(image, 0, 0);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to convert Mermaid SVG to PNG."));
        }
      }, "image/png");
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
