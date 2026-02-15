import { describe, expect, it } from 'bun:test';
import {
  decodeVideoSnapshotProgress,
  encodeVideoSnapshotProgress,
} from '../../apps/api/src/services/tools/video_snapshot_progress';

describe('video_snapshot_progress', () => {
  it('encodes and decodes snapshot progress payload', () => {
    const encoded = encodeVideoSnapshotProgress({
      screenshotBase64: 'abc123',
      atSeconds: 180,
      index: 1,
      total: 4,
      sourceUrl: 'https://example.com/video',
    });

    const decoded = decodeVideoSnapshotProgress(encoded);
    expect(decoded).toBeDefined();
    expect(decoded?.screenshotBase64).toBe('abc123');
    expect(decoded?.atSeconds).toBe(180);
    expect(decoded?.index).toBe(1);
    expect(decoded?.total).toBe(4);
    expect(decoded?.sourceUrl).toBe('https://example.com/video');
  });

  it('returns null for plain progress messages', () => {
    expect(decodeVideoSnapshotProgress('Downloading...')).toBeNull();
    expect(decodeVideoSnapshotProgress(undefined)).toBeNull();
    expect(decodeVideoSnapshotProgress('')).toBeNull();
  });

  it('returns null for malformed encoded payloads', () => {
    expect(decodeVideoSnapshotProgress('__video_snapshot__{')).toBeNull();
    expect(
      decodeVideoSnapshotProgress(
        '__video_snapshot__' +
          JSON.stringify({ screenshotBase64: '', atSeconds: -1, index: -1, total: 0 })
      )
    ).toBeNull();
  });
});

