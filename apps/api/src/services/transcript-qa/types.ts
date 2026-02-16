export type QueryIntent =
  | 'summary'
  | 'time_range'
  | 'factoid'
  | 'compare'
  | 'yes_no'
  | 'unknown';

export type ScriptType = 'cjk' | 'latin' | 'mixed' | 'unknown';

export type TimeRange = {
  startSeconds: number;
  endSeconds: number;
};

export type TranscriptSegment = {
  id: string;
  stamp: string;
  startSeconds: number;
  endSeconds: number;
  text: string;
  normalizedText: string;
  latinTokens: string[];
  cjkTokens: string[];
};

export type TranscriptDocument = {
  segments: TranscriptSegment[];
  script: ScriptType;
  fullText: string;
};

export type QueryUnderstanding = {
  rawQuery: string;
  normalizedQuery: string;
  intent: QueryIntent;
  script: ScriptType;
  keywords: string[];
  timeRange?: TimeRange;
  preferChinese: boolean;
};

export type EvidenceItem = {
  segmentId: string;
  stamp: string;
  startSeconds: number;
  text: string;
  score: number;
  reasons: string[];
};

export type RetrievalResult = {
  evidence: EvidenceItem[];
  confidence: 'high' | 'medium' | 'low';
  mode: 'time_range' | 'hybrid' | 'timeline';
};

export type TranscriptQaResponse = {
  content: string;
  status: 'answered' | 'insufficient_evidence';
  evidence: EvidenceItem[];
  confidence: 'high' | 'medium' | 'low';
};

export interface EmbeddingProvider {
  embedTexts(texts: string[]): Promise<number[][]>;
}

export interface TranscriptQaLlm extends Partial<EmbeddingProvider> {
  streamChat?: (messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>) => AsyncGenerator<{
    type: 'content' | 'tool_call' | 'done';
    content?: string;
  }>;
}
