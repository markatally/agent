import fs from 'fs/promises';
import path from 'path';
import type { ProgressCallback } from './types';
import { encodeVideoSnapshotProgress } from './video_snapshot_progress';

type ExecFileResult = { stdout: string; stderr: string };
export type ExecFileFn = (
  command: string,
  args: string[],
  options?: { timeout?: number; maxBuffer?: number }
) => Promise<ExecFileResult>;

const TARGET_SNAPSHOT_INTERVAL_SECONDS = 180;
const MIN_SNAPSHOTS = 10;
const MAX_SNAPSHOTS = 20;
const SNAPSHOT_SCALE_WIDTH = 960;

async function isCommandAvailable(
  execFileFn: ExecFileFn,
  command: string,
  args: string[]
): Promise<boolean> {
  try {
    await execFileFn(command, args, { timeout: 10000, maxBuffer: 2 * 1024 * 1024 });
    return true;
  } catch {
    return false;
  }
}

async function getVideoDurationSeconds(
  execFileFn: ExecFileFn,
  filepath: string
): Promise<number | null> {
  try {
    const { stdout } = await execFileFn(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        filepath,
      ],
      { timeout: 15000, maxBuffer: 2 * 1024 * 1024 }
    );
    const parsed = Number.parseFloat(String(stdout || '').trim());
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function buildSnapshotOffsets(durationSeconds: number | null): number[] {
  if (!durationSeconds || durationSeconds <= 0) {
    return [0];
  }

  const estimatedCount = Math.round(durationSeconds / TARGET_SNAPSHOT_INTERVAL_SECONDS) + 1;
  const snapshotCount = Math.max(MIN_SNAPSHOTS, Math.min(MAX_SNAPSHOTS, estimatedCount));
  if (snapshotCount <= 1) return [0];

  const maxOffset = Math.max(0, durationSeconds - 0.5);
  if (maxOffset <= 0) return [0];

  const offsets: number[] = [];
  for (let i = 0; i < snapshotCount; i += 1) {
    const raw = (maxOffset * i) / (snapshotCount - 1);
    const rounded = Number(raw.toFixed(3));
    if (offsets.length === 0 || rounded > offsets[offsets.length - 1]) {
      offsets.push(rounded);
    }
  }
  return offsets.length > 0 ? offsets : [0];
}

export async function extractPreviewSnapshots(
  execFileFn: ExecFileFn,
  inputPath: string,
  outputDir: string,
  sourceUrl: string,
  onProgress?: ProgressCallback,
  progress: { base: number; span: number } = { base: 70, span: 20 }
): Promise<string[]> {
  const ffmpegAvailable = await isCommandAvailable(execFileFn, 'ffmpeg', ['-version']);
  if (!ffmpegAvailable) {
    return [];
  }

  const durationSeconds = await getVideoDurationSeconds(execFileFn, inputPath);
  const offsets = buildSnapshotOffsets(durationSeconds);
  const snapshots: string[] = [];

  for (let i = 0; i < offsets.length; i += 1) {
    const offset = offsets[i];
    const framePath = path.join(
      outputDir,
      `snapshot-${path.basename(inputPath)}-${i}-${Date.now()}.jpg`
    );

    try {
      await execFileFn(
        'ffmpeg',
        [
          '-y',
          '-ss',
          offset.toFixed(3),
          '-i',
          inputPath,
          '-frames:v',
          '1',
          '-vf',
          `scale=${SNAPSHOT_SCALE_WIDTH}:-2`,
          '-q:v',
          '7',
          framePath,
        ],
        {
          timeout: 30000,
          maxBuffer: 8 * 1024 * 1024,
        }
      );
      const frame = await fs.readFile(framePath);
      const base64 = frame.toString('base64');
      snapshots.push(`data:image/jpeg;base64,${base64}`);

      const currentProgress =
        progress.base + Math.round(((i + 1) / offsets.length) * progress.span);
      onProgress?.(
        currentProgress,
        100,
        encodeVideoSnapshotProgress({
          screenshotBase64: base64,
          atSeconds: offset,
          index: i,
          total: offsets.length,
          sourceUrl,
        })
      );
    } catch {
      // Continue on frame extraction failure; snapshots are best effort.
    } finally {
      await fs.rm(framePath, { force: true }).catch(() => {});
    }
  }

  return snapshots;
}
