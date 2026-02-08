/**
 * Shared download utility for file downloads
 * Uses the authenticated download endpoint with Bearer token
 */

import { filesApi } from './api';

/**
 * Trigger a file download using the authenticated API
 * The browser will download the file to the default download folder
 *
 * @param sessionId - The session ID
 * @param fileId - The file ID
 * @param filename - The filename to save as
 */
export async function triggerDownload(
  sessionId: string,
  fileId: string,
  filename: string
): Promise<void> {
  try {
    const blob = await filesApi.download(sessionId, fileId);
    const blobUrl = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('Download failed:', error);
    throw error;
  }
}
