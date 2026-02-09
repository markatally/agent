/**
 * Paper Search Tool Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PaperSearchTool } from '../../apps/api/src/services/tools/paper_search';
import type { ToolContext } from '../../apps/api/src/services/tools/types';

describe('PaperSearchTool', () => {
  let mockContext: ToolContext;

  beforeEach(() => {
    mockContext = {
      sessionId: 'test-session',
      userId: 'test-user',
      workspaceDir: '/tmp/test-papersearch-workspace',
    };
  });

  it('infers year constraint from query text when dateRange is omitted', async () => {
    const orchestrator = vi.fn().mockResolvedValue({
      papers: [
        {
          title: 'DropoutTS: Towards Robust Time Series Foundation Model',
          authors: ['Author One'],
          abstract: 'Test abstract for time series model paper',
          link: 'https://arxiv.org/abs/2601.21726',
          source: 'arxiv',
          publicationDate: '2026-01-29',
          publicationDateSource: 'arxiv_v1',
          publicationDateConfidence: 'high',
        },
      ],
      sourcesQueried: ['arxiv'],
      sourcesSkipped: [],
      exclusionReasons: [],
    });

    const tool = new PaperSearchTool(mockContext, { runOrchestrator: orchestrator });

    const result = await tool.execute({
      query: 'collect hottest 1 paper on ML Timeseries released in 2026',
      topK: 1,
      sortBy: 'date',
    });

    expect(result.success).toBe(true);
    expect(orchestrator).toHaveBeenCalledTimes(1);

    const callArg = orchestrator.mock.calls[0][0];
    expect(callArg.dateRange).toBe('2026');
    expect(callArg.sortBy).toBe('date');
    expect(callArg.query).not.toContain('2026');
    expect(callArg.absoluteDateWindow?.strict).toBe(true);
  });

  it('keeps explicit dateRange param over query inference', async () => {
    const orchestrator = vi.fn().mockResolvedValue({
      papers: [],
      sourcesQueried: ['arxiv'],
      sourcesSkipped: [],
      exclusionReasons: [],
    });

    const tool = new PaperSearchTool(mockContext, { runOrchestrator: orchestrator });

    await tool.execute({
      query: 'time series papers in 2026',
      dateRange: '2025',
      topK: 5,
    });

    const callArg = orchestrator.mock.calls[0][0];
    expect(callArg.dateRange).toBe('2025');
  });

  it('uses relevance ranking when no hottest/top intent is present', async () => {
    const orchestrator = vi.fn().mockResolvedValue({
      papers: [],
      sourcesQueried: ['arxiv'],
      sourcesSkipped: [],
      exclusionReasons: [],
    });

    const tool = new PaperSearchTool(mockContext, { runOrchestrator: orchestrator });

    await tool.execute({
      query: 'machine learning time series forecasting',
      topK: 5,
    });

    const callArg = orchestrator.mock.calls[0][0];
    expect(callArg.sortBy).toBe('relevance');
  });
});
