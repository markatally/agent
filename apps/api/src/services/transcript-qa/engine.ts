import { parseTranscriptDocument } from './parser';
import { understandTranscriptQueryWithLlm } from './query-understanding';
import { retrieveTranscriptEvidence } from './hybrid-retriever';
import { synthesizeTranscriptAnswer } from './answer-synthesizer';
import { verifyGroundedAnswer } from './answer-verifier';
import { formatSeconds } from './parser';
import type { EvidenceItem, QueryUnderstanding, TranscriptQaLlm, TranscriptQaResponse } from './types';

function buildNoEvidenceMessage(preferChinese: boolean): string {
  return preferChinese
    ? '该问题在当前 transcript 中缺少足够证据，我无法确认答案。请换一个 transcript 中明确提到的问题。'
    : 'There is not enough evidence in the current transcript to answer this question. Please ask about content explicitly present in the transcript.';
}

function buildNoTimeRangeMessage(
  understanding: QueryUnderstanding,
  preferChinese: boolean
): string {
  if (!understanding.timeRange) return buildNoEvidenceMessage(preferChinese);
  const from = formatSeconds(understanding.timeRange.startSeconds).slice(3, 8);
  const to = formatSeconds(understanding.timeRange.endSeconds).slice(3, 8);
  return preferChinese
    ? `根据 transcript，没有定位到 ${from}-${to} 这段的字幕内容。请确认时间范围是否正确。`
    : `I could not find transcript lines within ${from}-${to}. Please verify the requested time range.`;
}

function buildVerifiedExtractiveFallback(
  evidence: EvidenceItem[],
  understanding: QueryUnderstanding
): string {
  if (evidence.length === 0) {
    return buildNoEvidenceMessage(understanding.preferChinese);
  }
  const sampled = (() => {
    if (evidence.length <= 6) return evidence;
    const selected = new Map<number, EvidenceItem>();
    selected.set(0, evidence[0]);
    selected.set(evidence.length - 1, evidence[evidence.length - 1]);
    for (let i = 1; i < 5; i += 1) {
      const idx = Math.floor((i / 5) * (evidence.length - 1));
      selected.set(idx, evidence[idx]);
    }
    return Array.from(selected.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, item]) => item);
  })();
  const idToIndex = new Map<string, number>();
  for (let i = 0; i < evidence.length; i += 1) {
    if (!idToIndex.has(evidence[i].segmentId)) idToIndex.set(evidence[i].segmentId, i + 1);
  }
  const lines = sampled.map((item) => {
    const citeIndex = idToIndex.get(item.segmentId) || 1;
    return `- ${item.stamp} ${item.text.slice(0, 120)} [E${citeIndex}]`;
  });
  if (understanding.intent === 'summary') {
    const header = understanding.timeRange
      ? understanding.preferChinese
        ? '根据 transcript，这一段的重点如下：'
        : 'According to the transcript, key points in this section are:'
      : understanding.preferChinese
      ? '根据 transcript，视频重点如下：'
      : 'According to the transcript, key video highlights are:';
    return understanding.preferChinese
      ? [header, ...lines].join('\n')
      : [header, ...lines].join('\n');
  }
  return understanding.preferChinese
    ? ['根据 transcript，可确认的信息如下：', ...lines].join('\n')
    : ['According to the transcript, confirmed evidence is:', ...lines].join('\n');
}

export async function answerVideoQueryFromTranscript(params: {
  llm: TranscriptQaLlm;
  userQuery: string;
  transcriptText: string;
}): Promise<TranscriptQaResponse> {
  const { llm, userQuery, transcriptText } = params;
  const document = parseTranscriptDocument(transcriptText);
  const transcriptDurationSeconds = document.segments[document.segments.length - 1]?.endSeconds ?? 0;
  const effectiveUnderstanding = await understandTranscriptQueryWithLlm({
    llm,
    query: userQuery,
    transcriptScript: document.script,
    durationSeconds: transcriptDurationSeconds,
  });

  const retrieval = await retrieveTranscriptEvidence({
    document,
    understanding: effectiveUnderstanding,
    embeddingProvider: llm.embedTexts ? { embedTexts: llm.embedTexts.bind(llm) } : undefined,
  });

  if (retrieval.evidence.length === 0) {
    return {
      content:
        effectiveUnderstanding.intent === 'time_range' || effectiveUnderstanding.timeRange
          ? buildNoTimeRangeMessage(effectiveUnderstanding, effectiveUnderstanding.preferChinese)
          : buildNoEvidenceMessage(effectiveUnderstanding.preferChinese),
      status: 'insufficient_evidence',
      evidence: [],
      confidence: 'low',
    };
  }

  const answer = await synthesizeTranscriptAnswer({
    llm,
    query: userQuery,
    understanding: effectiveUnderstanding,
    evidence: retrieval.evidence,
  });

  const verification = verifyGroundedAnswer({
    answer,
    evidence: retrieval.evidence,
    understanding: effectiveUnderstanding,
  });

  if (!verification.ok) {
    return {
      content: buildVerifiedExtractiveFallback(retrieval.evidence, effectiveUnderstanding),
      status: retrieval.confidence === 'low' ? 'insufficient_evidence' : 'answered',
      evidence: retrieval.evidence,
      confidence: retrieval.confidence,
    };
  }

  return {
    content: answer,
    status: 'answered',
    evidence: retrieval.evidence,
    confidence: retrieval.confidence,
  };
}
