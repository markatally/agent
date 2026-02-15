const VIDEO_SNAPSHOT_PROGRESS_PREFIX = '__video_snapshot__';

export interface VideoSnapshotProgressPayload {
  screenshotBase64: string;
  atSeconds: number;
  index: number;
  total: number;
  sourceUrl?: string;
}

export function encodeVideoSnapshotProgress(
  payload: VideoSnapshotProgressPayload
): string {
  return `${VIDEO_SNAPSHOT_PROGRESS_PREFIX}${JSON.stringify(payload)}`;
}

export function decodeVideoSnapshotProgress(
  message: string | undefined
): VideoSnapshotProgressPayload | null {
  if (!message || !message.startsWith(VIDEO_SNAPSHOT_PROGRESS_PREFIX)) {
    return null;
  }

  const rawPayload = message.slice(VIDEO_SNAPSHOT_PROGRESS_PREFIX.length);
  if (!rawPayload) return null;

  try {
    const parsed = JSON.parse(rawPayload) as VideoSnapshotProgressPayload;
    if (
      !parsed ||
      typeof parsed.screenshotBase64 !== 'string' ||
      !parsed.screenshotBase64 ||
      typeof parsed.atSeconds !== 'number' ||
      !Number.isFinite(parsed.atSeconds) ||
      parsed.atSeconds < 0 ||
      typeof parsed.index !== 'number' ||
      !Number.isFinite(parsed.index) ||
      parsed.index < 0 ||
      typeof parsed.total !== 'number' ||
      !Number.isFinite(parsed.total) ||
      parsed.total <= 0
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

