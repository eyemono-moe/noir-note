export const LICENSE_DIALOG_TITLE = "Licenses";
export const LICENSE_MARKDOWN_PATH = "/licenses.md";

export async function loadLicenseMarkdown(fetcher: typeof fetch = fetch): Promise<string> {
  const response = await fetcher(LICENSE_MARKDOWN_PATH);

  if (!response.ok) {
    throw new Error(`Failed to load licenses.md: ${response.status} ${response.statusText}`.trim());
  }

  return response.text();
}
