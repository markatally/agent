import { formatSeconds } from './parser';
import type { EvidenceItem, QueryUnderstanding, TranscriptQaLlm } from './types';

function buildEvidenceBlock(evidence: EvidenceItem[]): string {
  return evidence
    .map((item, idx) => `${idx + 1}. [E${idx + 1}] ${item.stamp} ${item.text}`)
    .join('\n');
}

function sampleSummaryEvidence(evidence: EvidenceItem[], maxItems: number): EvidenceItem[] {
  if (evidence.length <= maxItems) return evidence;
  const selected = new Map<number, EvidenceItem>();
  selected.set(0, evidence[0]);
  selected.set(evidence.length - 1, evidence[evidence.length - 1]);
  if (maxItems > 2) {
    for (let i = 1; i < maxItems - 1; i += 1) {
      const idx = Math.floor((i / (maxItems - 1)) * (evidence.length - 1));
      selected.set(idx, evidence[idx]);
    }
  }
  return Array.from(selected.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, item]) => item);
}

function buildExtractiveFallback(params: {
  understanding: QueryUnderstanding;
  evidence: EvidenceItem[];
}): string {
  const { understanding, evidence } = params;
  if (evidence.length === 0) {
    return understanding.preferChinese
      ? '当前 transcript 中没有足够证据回答这个问题。'
      : 'There is not enough evidence in the transcript to answer this question.';
  }

  if (understanding.intent === 'summary') {
    const sampled = sampleSummaryEvidence(evidence, 6);
    const idToIndex = new Map<string, number>();
    for (let i = 0; i < evidence.length; i += 1) {
      if (!idToIndex.has(evidence[i].segmentId)) idToIndex.set(evidence[i].segmentId, i + 1);
    }
    const lines = sampled.map((item) => {
      const citeIndex = idToIndex.get(item.segmentId) || 1;
      return `- ${item.stamp} ${item.text.slice(0, 120)} [E${citeIndex}]`;
    });
    const header = understanding.timeRange
      ? understanding.preferChinese
        ? '根据 transcript，这一段的重点是：'
        : 'According to the transcript, key points in this section are:'
      : understanding.preferChinese
      ? '根据 transcript，视频重点是：'
      : 'According to the transcript, the video highlights are:';
    return understanding.preferChinese
      ? [header, ...lines].join('\n')
      : [header, ...lines].join('\n');
  }

  const lines = evidence.map((item, idx) => `- ${item.stamp} ${item.text.slice(0, 200)} [E${idx + 1}]`);
  if (understanding.intent === 'time_range' && understanding.timeRange) {
    const range = `${formatSeconds(understanding.timeRange.startSeconds).slice(3, 8)}-${formatSeconds(
      understanding.timeRange.endSeconds
    ).slice(3, 8)}`;
    return understanding.preferChinese
      ? [`根据 transcript，${range} 这段主要内容如下：`, ...lines].join('\n')
      : [`According to the transcript, this is what is covered in ${range}:`, ...lines].join('\n');
  }
  return understanding.preferChinese
    ? ['根据 transcript，相关内容如下：', ...lines].join('\n')
    : ['According to the transcript, relevant evidence is:', ...lines].join('\n');
}

async function generateWithLlm(params: {
  llm: TranscriptQaLlm;
  query: string;
  understanding: QueryUnderstanding;
  evidence: EvidenceItem[];
}): Promise<string> {
  const { llm, query, understanding, evidence } = params;
  if (!llm.streamChat) return '';

  const system = [
    'You are a transcript-grounded QA assistant.',
    'Answer ONLY from the provided evidence lines.',
    'Do not use external knowledge, metadata, or guesses.',
    'For every claim, append at least one citation tag like [E1].',
    understanding.preferChinese
      ? 'Respond in Simplified Chinese.'
      : 'Respond in the same language as the user query.',
  ].join('\n');

  const user = [
    `User question: ${query}`,
    '',
    'Evidence lines:',
    buildEvidenceBlock(evidence),
    '',
    'Response requirements:',
    '1) concise and directly answer the question',
    '2) cite evidence tags [E#] per statement',
    '3) if evidence is insufficient, explicitly state that',
  ].join('\n');

  let output = '';
  for await (const chunk of llm.streamChat([
    { role: 'system', content: system },
    { role: 'user', content: user },
  ])) {
    if (chunk.type === 'content' && chunk.content) output += chunk.content;
  }
  return output.trim();
}

export async function synthesizeTranscriptAnswer(params: {
  llm: TranscriptQaLlm;
  query: string;
  understanding: QueryUnderstanding;
  evidence: EvidenceItem[];
}): Promise<string> {
  const { llm, query, understanding, evidence } = params;
  if (evidence.length === 0) {
    return buildExtractiveFallback({ understanding, evidence });
  }

  // Time-range Q&A must be deterministic and extractive for maximum robustness.
  if (understanding.intent === 'time_range') {
    return buildExtractiveFallback({ understanding, evidence });
  }

  const llmAnswer = await generateWithLlm({ llm, query, understanding, evidence });
  if (llmAnswer) return llmAnswer;
  return buildExtractiveFallback({ understanding, evidence });
}
