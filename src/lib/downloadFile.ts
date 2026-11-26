const REVOKE_AFTER_MS = 10_000;

/**
 * Saves `content` as `fileName` through a temporary object URL and link, then
 * cleans both up. The URL is revoked a while later, not straight after the click:
 * some browsers (Safari among them) start reading it only after the click
 * returns, and a slow device may take a moment to begin the download.
 */
export function downloadFile(fileName: string, content: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
  }
}
