import { tokenizeQuery } from './parser';
import type { EvidenceItem, QueryUnderstanding } from './types';

type VerificationResult = {
  ok: boolean;
  reason?: string;
};

function extractCitations(answer: string): string[] {
  return answer.match(/\[E\d+\]/g) || [];
}

function noveltyRatio(answer: string, evidence: EvidenceItem[]): number {
  const evidenceText = evidence.map((e) => e.text).join('\n');
  const evidenceTokens = new Set(tokenizeQuery(evidenceText));
  const answerTokens = tokenizeQuery(answer);
  if (answerTokens.length === 0) return 1;
  let unknown = 0;
  for (const token of answerTokens) {
    if (!evidenceTokens.has(token)) unknown += 1;
  }
  return unknown / answerTokens.length;
}

export function verifyGroundedAnswer(params: {
  answer: string;
  evidence: EvidenceItem[];
  understanding: QueryUnderstanding;
}): VerificationResult {
  const { answer, evidence, understanding } = params;
  if (!answer.trim()) return { ok: false, reason: 'empty-answer' };
  if (evidence.length === 0) return { ok: false, reason: 'no-evidence' };

  const citations = extractCitations(answer);
  if (citations.length === 0) {
    return { ok: false, reason: 'missing-citations' };
  }

  const ratio = noveltyRatio(answer, evidence);
  const threshold = understanding.intent === 'summary' ? 0.65 : 0.55;
  if (ratio > threshold) {
    return { ok: false, reason: 'unsupported-novel-terms' };
  }
  return { ok: true };
}
