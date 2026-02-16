import type { ScriptType, TranscriptDocument, TranscriptSegment } from './types';

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeTranscriptText(value: string): string {
  return normalizeWhitespace(
    value
      .replace(/<[^>]*>/g, ' ')
      .replace(/\{\\an\d\}/g, ' ')
      .replace(/\[[^\]]*?\]/g, ' ')
  );
}

export function parseHmsToSeconds(value: string): number | null {
  const parts = value.split(':');
  if (parts.length !== 3) return null;
  const hh = Number(parts[0]);
  const mm = Number(parts[1]);
  const ss = Number(parts[2].replace(',', '.'));
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || !Number.isFinite(ss)) return null;
  if (mm < 0 || mm > 59 || ss < 0 || ss >= 60) return null;
  return hh * 3600 + mm * 60 + ss;
}

function detectScript(value: string): ScriptType {
  const compact = value.replace(/\s/g, '');
  if (!compact) return 'unknown';
  const cjkCount = (compact.match(/[\u4e00-\u9fff]/g) || []).length;
  const latinCount = (compact.match(/[A-Za-z]/g) || []).length;
  if (cjkCount === 0 && latinCount === 0) return 'unknown';
  const cjkRatio = cjkCount / compact.length;
  const latinRatio = latinCount / compact.length;
  if (cjkRatio > 0.6) return 'cjk';
  if (latinRatio > 0.6) return 'latin';
  return 'mixed';
}

const CJK_STOPWORDS = new Set([
  '这个',
  '那个',
  '我们',
  '你们',
  '他们',
  '以及',
  '然后',
  '就是',
  '一个',
  '一下',
  '视频',
  '内容',
  '什么',
  '怎么',
  '这里',
  '那里',
]);

const LATIN_STOPWORDS = new Set([
  'this',
  'that',
  'with',
  'from',
  'have',
  'been',
  'will',
  'about',
  'there',
  'which',
  'video',
  'transcript',
  'summary',
  'more',
  'detail',
  'what',
  'when',
  'where',
]);

function tokenizeLatin(value: string): string[] {
  return Array.from(new Set((value.toLowerCase().match(/[a-z]{3,}/g) || []).filter((t) => !LATIN_STOPWORDS.has(t))));
}

function tokenizeCjk(value: string): string[] {
  const runs = value.match(/[\u4e00-\u9fff]{2,}/g) || [];
  const tokens: string[] = [];
  for (const run of runs) {
    if (run.length <= 2) {
      if (!CJK_STOPWORDS.has(run)) tokens.push(run);
      continue;
    }
    for (let i = 0; i < run.length - 1; i += 1) {
      const bi = run.slice(i, i + 2);
      if (!CJK_STOPWORDS.has(bi)) tokens.push(bi);
    }
  }
  return Array.from(new Set(tokens));
}

export function parseTranscriptDocument(transcriptText: string): TranscriptDocument {
  const lines = transcriptText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const segments: TranscriptSegment[] = [];
  let fallbackCursor = 0;
  for (const line of lines) {
    const match = line.match(
      /^\[(\d{2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[.,]\d{3})\]\s*(.+)$/
    );

    if (!match) {
      const text = normalizeTranscriptText(line.replace(/^\[[^\]]+\]\s*/, ''));
      if (!text) continue;
      const start = fallbackCursor;
      const end = fallbackCursor + 4;
      fallbackCursor = end;
      segments.push({
        id: `s-${segments.length + 1}`,
        stamp: `[${formatSeconds(start)} --> ${formatSeconds(end)}]`,
        startSeconds: start,
        endSeconds: end,
        text,
        normalizedText: text.toLowerCase(),
        latinTokens: tokenizeLatin(text),
        cjkTokens: tokenizeCjk(text),
      });
      continue;
    }

    const text = normalizeTranscriptText(match[3]);
    if (!text) continue;
    const startSeconds = parseHmsToSeconds(match[1].replace(',', '.')) ?? fallbackCursor;
    const endSeconds = parseHmsToSeconds(match[2].replace(',', '.')) ?? Math.max(startSeconds + 1, fallbackCursor + 4);
    fallbackCursor = Math.max(fallbackCursor, endSeconds);
    segments.push({
      id: `s-${segments.length + 1}`,
      stamp: `[${match[1].replace(',', '.')} --> ${match[2].replace(',', '.')}]`,
      startSeconds,
      endSeconds,
      text,
      normalizedText: text.toLowerCase(),
      latinTokens: tokenizeLatin(text),
      cjkTokens: tokenizeCjk(text),
    });
  }

  const fullText = segments.map((s) => s.text).join('\n');
  return {
    segments,
    script: detectScript(fullText),
    fullText,
  };
}

export function formatSeconds(totalSeconds: number): string {
  const normalized = Math.max(0, Math.floor(totalSeconds));
  const hh = Math.floor(normalized / 3600);
  const mm = Math.floor((normalized % 3600) / 60);
  const ss = normalized % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}.000`;
}

export function detectScriptFromText(value: string): ScriptType {
  return detectScript(value);
}

export function tokenizeQuery(value: string): string[] {
  return Array.from(new Set([...tokenizeLatin(value), ...tokenizeCjk(value)]));
}

