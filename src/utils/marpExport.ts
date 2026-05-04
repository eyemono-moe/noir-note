/**
 * Utilities for exporting Marp slide documents from the browser.
 *
 * HTML export is fully client-side. PDF export uses the browser's native print
 * dialog (Marp's CSS includes `@media print` slide layout rules).
 */

/**
 * Render `content` with Marp and return a standalone HTML string that can be
 * saved as a `.html` file and opened in any browser.
 */
export async function buildMarpHtml(content: string, title = "Slide"): Promise<string> {
  const { Marp } = await import("@marp-team/marp-core");
  const marp = new Marp();
  const { html, css } = marp.render(content);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>${css}</style>
</head>
<body>
${html}
</body>
</html>`;
}

/**
 * Trigger a browser download of `content` as a UTF-8 HTML file.
 */
export function downloadHtml(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  } finally {
    // Revoke after a tick so the browser has time to start the download.
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
