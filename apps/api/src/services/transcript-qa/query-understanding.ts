import { detectScriptFromText, tokenizeQuery } from './parser';
import type { QueryIntent, QueryUnderstanding, ScriptType, TimeRange, TranscriptQaLlm } from './types';

type TimeMention = {
  seconds: number;
  index: number;
};

type RelativeRange = {
  startRatio: number;
  endRatio: number;
};

const CN_DIGITS: Record<string, number> = {
  零: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

function parseMmSs(match: RegExpMatchArray): number | null {
  const a = Number(match[1]);
  const b = Number(match[2]);
  const c = match[3] != null ? Number(match[3]) : null;
  if (!Number.isFinite(a) || !Number.isFinite(b) || b > 59) return null;
  if (c == null) return a * 60 + b;
  if (!Number.isFinite(c) || c > 59) return null;
  return a * 3600 + b * 60 + c;
}

function extractTimeMentionsWithIndex(text: string): TimeMention[] {
  const mentions: TimeMention[] = [];
  const push = (seconds: number | null, index: number) => {
    if (seconds == null || !Number.isFinite(seconds) || seconds < 0 || index < 0) return;
    mentions.push({ seconds, index });
  };

  for (const m of text.matchAll(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/g)) {
    push(parseMmSs(m), m.index ?? -1);
  }

  for (const m of text.matchAll(/(\d{1,3})\s*分(?:钟)?\s*([0-5]?\d)\s*秒/g)) {
    const mm = Number(m[1]);
    const ss = Number(m[2]);
    if (!Number.isFinite(mm) || !Number.isFinite(ss) || ss > 59) continue;
    push(mm * 60 + ss, m.index ?? -1);
  }

  for (const m of text.matchAll(/(\d{1,3})\s*分半/g)) {
    const mm = Number(m[1]);
    if (!Number.isFinite(mm)) continue;
    push(mm * 60 + 30, m.index ?? -1);
  }

  return mentions.sort((a, b) => a.index - b.index);
}

function parseChineseInt(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  if (/^\d+$/.test(text)) return Number(text);
  if (text === '十') return 10;
  if (text.startsWith('十')) {
    const tail = CN_DIGITS[text.slice(1)];
    return tail == null ? null : 10 + tail;
  }
  if (text.endsWith('十')) {
    const head = CN_DIGITS[text.slice(0, -1)];
    return head == null ? null : head * 10;
  }
  const tenIdx = text.indexOf('十');
  if (tenIdx > 0) {
    const head = CN_DIGITS[text.slice(0, tenIdx)];
    const tail = CN_DIGITS[text.slice(tenIdx + 1)];
    if (head == null || tail == null) return null;
    return head * 10 + tail;
  }
  return CN_DIGITS[text] ?? null;
}

function toRelativeRange(position: 'head' | 'tail', numerator: number, denominator: number): RelativeRange | undefined {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || numerator <= 0 || denominator <= 0) {
    return undefined;
  }
  const ratio = Math.min(1, numerator / denominator);
  if (ratio <= 0) return undefined;
  return position === 'head' ? { startRatio: 0, endRatio: ratio } : { startRatio: 1 - ratio, endRatio: 1 };
}

function extractRelativeRange(query: string): RelativeRange | undefined {
  const normalized = query.trim().toLowerCase();

  for (const m of query.matchAll(/(前面|后面|前|后)\s*(\d{1,2})\s*\/\s*(\d{1,2})/g)) {
    const position = m[1].startsWith('后') ? 'tail' : 'head';
    const numerator = Number(m[2]);
    const denominator = Number(m[3]);
    const range = toRelativeRange(position, numerator, denominator);
    if (range) return range;
  }

  for (const m of query.matchAll(/(前面|后面|前|后)\s*([一二两三四五六七八九十\d]{1,4})\s*分之\s*([一二两三四五六七八九十\d]{1,4})/g)) {
    const position = m[1].startsWith('后') ? 'tail' : 'head';
    const denominator = parseChineseInt(m[2]);
    const numerator = parseChineseInt(m[3]);
    if (denominator == null || numerator == null) continue;
    const range = toRelativeRange(position, numerator, denominator);
    if (range) return range;
  }

  if (/前半(段|部分|程)?/.test(query)) return { startRatio: 0, endRatio: 0.5 };
  if (/后半(段|部分|程)?/.test(query)) return { startRatio: 0.5, endRatio: 1 };
  if (/\bfirst\s+half\b/.test(normalized)) return { startRatio: 0, endRatio: 0.5 };
  if (/\blast\s+half\b/.test(normalized)) return { startRatio: 0.5, endRatio: 1 };
  if (/\bfirst\s+third\b/.test(normalized)) return { startRatio: 0, endRatio: 1 / 3 };
  if (/\blast\s+third\b/.test(normalized)) return { startRatio: 2 / 3, endRatio: 1 };
  if (/\bfirst\s+quarter\b/.test(normalized)) return { startRatio: 0, endRatio: 0.25 };
  if (/\blast\s+quarter\b/.test(normalized)) return { startRatio: 0.75, endRatio: 1 };

  for (const m of normalized.matchAll(/\b(first|last)\s+(\d{1,2})\s*\/\s*(\d{1,2})\b/g)) {
    const position = m[1] === 'last' ? 'tail' : 'head';
    const numerator = Number(m[2]);
    const denominator = Number(m[3]);
    const range = toRelativeRange(position, numerator, denominator);
    if (range) return range;
  }

  return undefined;
}

export function resolveRelativeTimeRange(query: string, durationSeconds: number): TimeRange | undefined {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return undefined;
  const relative = extractRelativeRange(query);
  if (!relative) return undefined;
  const startSeconds = Math.max(0, Math.floor(durationSeconds * relative.startRatio));
  const endSeconds = Math.min(durationSeconds, Math.ceil(durationSeconds * relative.endRatio));
  if (endSeconds <= startSeconds) return undefined;
  return { startSeconds, endSeconds };
}

function extractTimeRange(text: string): TimeRange | undefined {
  const hasRangeCue = /到|至|之间|from|between|to|[-~～—]/i.test(text);
  if (!hasRangeCue) return undefined;

  const mentions = extractTimeMentionsWithIndex(text);
  if (mentions.length < 2) return undefined;

  const startSeconds = Math.min(mentions[0].seconds, mentions[1].seconds);
  const endSeconds = Math.max(mentions[0].seconds, mentions[1].seconds);
  if (endSeconds <= startSeconds || endSeconds - startSeconds > 3600) return undefined;

  return { startSeconds, endSeconds };
}

function inferIntent(query: string, hasTimeRange: boolean): QueryIntent {
  if (hasTimeRange) return 'time_range';
  const normalized = query.toLowerCase();
  const hasVideoReference =
    /视频|video|this video|the video|该视频|这个视频|this clip|clip/i.test(query);
  const hasBroadOverviewCue =
    /\b(overview|highlights|key points|main points|gist|what is (this|the) video about)\b|重点|主要|核心|大意|简介|介绍.*(内容|重点|核心)?|讲了什么|讲了啥/i.test(
      query
    );

  if (hasVideoReference && hasBroadOverviewCue) {
    return 'summary';
  }

  if (
    /\b(summary|summarize|overview|recap|highlights)\b|总结|概述|梳理|复盘|详细总结|更详细/i.test(query)
  ) {
    return 'summary';
  }
  if (/\b(compare|difference|versus|vs)\b|区别|对比|相比|差异/i.test(query)) {
    return 'compare';
  }
  if (/\?|吗|是不是|是否|有没有/.test(query)) {
    return 'yes_no';
  }
  if (/\bwhat|which|who|how|why|where|when\b|讲了啥|讲了什么|提到什么|内容是什么/i.test(query)) {
    return 'factoid';
  }
  return 'unknown';
}

function shouldPreferChinese(query: string, script: ScriptType): boolean {
  if (/[\u4e00-\u9fff]/.test(query) && !/\b(english|in english)\b/i.test(query)) return true;
  return script === 'cjk';
}

function shouldUseLlmQueryUnderstanding(base: QueryUnderstanding): boolean {
  if (base.timeRange) return false;
  return true;
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
}

function normalizeIntent(value: unknown): QueryIntent | undefined {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'summary') return 'summary';
  if (v === 'time_range' || v === 'timerange') return 'time_range';
  if (v === 'factoid') return 'factoid';
  if (v === 'compare') return 'compare';
  if (v === 'yes_no' || v === 'yesno') return 'yes_no';
  if (v === 'unknown') return 'unknown';
  return undefined;
}

function toNumber(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

function resolveLlmRange(
  rawRange: any,
  durationSeconds: number,
  fallbackRange?: TimeRange
): TimeRange | undefined {
  if (!rawRange || typeof rawRange !== 'object') return fallbackRange;
  const type = String(rawRange.type || 'none').toLowerCase();
  if (type === 'none') return fallbackRange;

  if (type === 'absolute') {
    const start = toNumber(rawRange.startSeconds);
    const end = toNumber(rawRange.endSeconds);
    if (start == null || end == null || end <= start) return fallbackRange;
    return {
      startSeconds: Math.max(0, Math.floor(start)),
      endSeconds: Math.max(0, Math.ceil(end)),
    };
  }

  if (type === 'relative') {
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return fallbackRange;
    const anchor = String(rawRange.anchor || 'head').toLowerCase();
    const numerator = toNumber(rawRange.numerator);
    const denominator = toNumber(rawRange.denominator);
    if (numerator == null || denominator == null || numerator <= 0 || denominator <= 0) {
      return fallbackRange;
    }
    const ratio = Math.min(1, numerator / denominator);
    const startRatio = anchor === 'tail' ? 1 - ratio : 0;
    const endRatio = anchor === 'tail' ? 1 : ratio;
    const startSeconds = Math.max(0, Math.floor(durationSeconds * startRatio));
    const endSeconds = Math.min(durationSeconds, Math.ceil(durationSeconds * endRatio));
    if (endSeconds <= startSeconds) return fallbackRange;
    return { startSeconds, endSeconds };
  }

  return fallbackRange;
}

async function inferQueryUnderstandingWithLlm(params: {
  llm: TranscriptQaLlm;
  query: string;
  durationSeconds: number;
}): Promise<{ intent?: QueryIntent; timeRange?: TimeRange; preferChinese?: boolean }> {
  const { llm, query, durationSeconds } = params;
  if (!llm.streamChat) return {};

  const system = [
    'You classify user intent for transcript QA.',
    'Return ONLY one JSON object. No markdown.',
    'Schema:',
    '{"intent":"summary|time_range|factoid|compare|yes_no|unknown","range":{"type":"none|absolute|relative","startSeconds":number,"endSeconds":number,"anchor":"head|tail","numerator":number,"denominator":number},"language":"zh|en|auto"}',
    'Use range.type="relative" for expressions like first/last half/third/quarter.',
    'If no range is requested, use range.type="none".',
  ].join('\n');

  const user = [
    `Query: ${query}`,
    `Transcript duration seconds: ${Math.max(0, Math.floor(durationSeconds))}`,
    'Output JSON now.',
  ].join('\n');

  let raw = '';
  for await (const chunk of llm.streamChat([
    { role: 'system', content: system },
    { role: 'user', content: user },
  ])) {
    if (chunk.type === 'content' && chunk.content) raw += chunk.content;
  }

  const json = extractJsonObject(raw);
  if (!json) return {};

  try {
    const parsed = JSON.parse(json) as any;
    const intent = normalizeIntent(parsed?.intent);
    const timeRange = resolveLlmRange(parsed?.range, durationSeconds);
    const language = String(parsed?.language || '').toLowerCase();
    return {
      intent,
      timeRange,
      preferChinese: language === 'zh' ? true : language === 'en' ? false : undefined,
    };
  } catch {
    return {};
  }
}

export function understandTranscriptQuery(query: string, transcriptScript: ScriptType): QueryUnderstanding {
  const normalizedQuery = query.trim();
  const timeRange = extractTimeRange(normalizedQuery);
  const script = detectScriptFromText(normalizedQuery);
  const intent = inferIntent(normalizedQuery, Boolean(timeRange));
  const keywords = tokenizeQuery(normalizedQuery);
  return {
    rawQuery: query,
    normalizedQuery,
    intent,
    script,
    keywords,
    timeRange,
    preferChinese: shouldPreferChinese(normalizedQuery, transcriptScript),
  };
}

export async function understandTranscriptQueryWithLlm(params: {
  llm: TranscriptQaLlm;
  query: string;
  transcriptScript: ScriptType;
  durationSeconds: number;
}): Promise<QueryUnderstanding> {
  const { llm, query, transcriptScript, durationSeconds } = params;
  const base = understandTranscriptQuery(query, transcriptScript);
  const relativeRangeFallback = base.timeRange
    ? undefined
    : resolveRelativeTimeRange(query, durationSeconds);
  const baseWithRelative: QueryUnderstanding = relativeRangeFallback
    ? {
        ...base,
        timeRange: relativeRangeFallback,
        intent: base.intent === 'summary' ? 'summary' : 'time_range',
      }
    : base;

  if (!shouldUseLlmQueryUnderstanding(baseWithRelative)) {
    return baseWithRelative;
  }

  const llmUnderstanding = await inferQueryUnderstandingWithLlm({
    llm,
    query,
    durationSeconds,
  });

  const finalRange = llmUnderstanding.timeRange || baseWithRelative.timeRange;
  const intent = llmUnderstanding.intent ?? baseWithRelative.intent;
  const finalIntent = finalRange && intent !== 'summary' ? 'time_range' : intent;

  return {
    ...baseWithRelative,
    intent: finalIntent,
    timeRange: finalRange,
    preferChinese: llmUnderstanding.preferChinese ?? baseWithRelative.preferChinese,
  };
}
