/**
 * Paper Search Orchestrator Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { createPaperSearchOrchestrator } from '../../apps/api/src/services/paper-search/orchestrator';
import type { PaperSearchSkill, RawPaperResult } from '../../apps/api/src/services/paper-search/types';

describe('Paper Search Orchestrator', () => {
  const mockSkill1: PaperSearchSkill = {
    id: 'skill1',
    name: 'Skill 1',
    description: 'Test skill 1',
    search: vi.fn().mockResolvedValue([
      {
        title: 'Paper 1',
        authors: ['Author A'],
        abstract: 'Abstract 1',
        url: 'https://example.com/1',
        source: 'arxiv',
        doi: '10.1234/paper1',
        publicationDate: '2023-01-15',
        publicationDateSource: 'arxiv_v1',
      },
    ] as RawPaperResult[]),
    resolveByDoi: vi.fn().mockResolvedValue(null),
  };

  const mockSkill2: PaperSearchSkill = {
    id: 'skill2',
    name: 'Skill 2',
    description: 'Test skill 2',
    search: vi.fn().mockResolvedValue([
      {
        title: 'Paper 2',
        authors: ['Author B'],
        abstract: 'Abstract 2',
        url: 'https://example.com/2',
        source: 'semantic_scholar',
        doi: '10.1234/paper2',
        publicationDate: '2023-02-20',
        publicationDateSource: 'semantic_scholar',
      },
    ] as RawPaperResult[]),
    resolveByDoi: vi.fn().mockResolvedValue(null),
  };

  it('should execute multiple skills in parallel', async () => {
    const orchestrator = createPaperSearchOrchestrator({
      skills: [mockSkill1, mockSkill2],
    });

    const result = await orchestrator({
      query: 'AI agents',
      options: { limit: 10 },
    });

    expect(mockSkill1.search).toHaveBeenCalled();
    expect(mockSkill2.search).toHaveBeenCalled();
    expect(result.papers).toHaveLength(2);
    expect(result.sourcesQueried).toContain('skill1');
    expect(result.sourcesQueried).toContain('skill2');
  });

  it('should deduplicate papers by DOI', async () => {
    const duplicateSkill: PaperSearchSkill = {
      id: 'skill3',
      name: 'Skill 3',
      description: 'Returns duplicate',
      search: vi.fn().mockResolvedValue([
        {
          title: 'Paper 1 (duplicate)',
          authors: ['Author A'],
          abstract: 'Abstract 1',
          url: 'https://example.com/1',
          source: 'semantic_scholar',
          doi: '10.1234/paper1', // Same DOI as mockSkill1
          publicationDate: '2023-01-15',
          publicationDateSource: 'semantic_scholar',
        },
      ] as RawPaperResult[]),
      resolveByDoi: vi.fn(),
    };

    const orchestrator = createPaperSearchOrchestrator({
      skills: [mockSkill1, duplicateSkill],
    });

    const result = await orchestrator({
      query: 'AI agents',
      options: { limit: 10 },
    });

    // Should only return 1 paper (deduplicated by DOI)
    expect(result.papers).toHaveLength(1);
  });

  it('should deduplicate papers by normalized title', async () => {
    const similarSkill: PaperSearchSkill = {
      id: 'skill3',
      name: 'Skill 3',
      description: 'Returns similar title',
      search: vi.fn().mockResolvedValue([
        {
          title: 'PAPER 1', // Same as "Paper 1" when normalized
          authors: ['Author A'],
          abstract: 'Abstract 1',
          url: 'https://example.com/1-alt',
          source: 'semantic_scholar',
          publicationDate: '2023-01-15',
        },
      ] as RawPaperResult[]),
      resolveByDoi: vi.fn(),
    };

    const orchestrator = createPaperSearchOrchestrator({
      skills: [mockSkill1, similarSkill],
    });

    const result = await orchestrator({
      query: 'AI agents',
      options: { limit: 10 },
    });

    // Should deduplicate by normalized title
    expect(result.papers).toHaveLength(1);
  });

  it('should prioritize crossref dates over other sources', async () => {
    const crossrefSkill: PaperSearchSkill = {
      id: 'crossref',
      name: 'CrossRef',
      description: 'CrossRef resolver',
      search: vi.fn().mockResolvedValue([]),
      resolveByDoi: vi.fn().mockResolvedValue({
        title: 'Paper 1',
        authors: ['Author A'],
        abstract: 'Abstract 1',
        url: 'https://example.com/1',
        source: 'other',
        doi: '10.1234/paper1',
        publicationDate: '2023-01-20', // Different date
        publicationDateSource: 'crossref',
      } as RawPaperResult),
    };

    const orchestrator = createPaperSearchOrchestrator({
      skills: [mockSkill1, crossrefSkill],
    });

    const result = await orchestrator({
      query: 'AI agents',
      options: { limit: 10 },
    });

    // Should use crossref date (2023-01-20) over arxiv date (2023-01-15)
    expect(result.papers[0].publicationDate).toBe('2023-01-20');
  });

  it('should apply sort order', async () => {
    const orchestrator = createPaperSearchOrchestrator({
      skills: [mockSkill1, mockSkill2],
    });

    const result = await orchestrator({
      query: 'AI agents',
      options: { limit: 10, sortBy: 'date' },
    });

    // Should be sorted by date (newest first)
    expect(result.papers[0].publicationDate).toBe('2023-02-20');
    expect(result.papers[1].publicationDate).toBe('2023-01-15');
  });

  it('should respect limit', async () => {
    const orchestrator = createPaperSearchOrchestrator({
      skills: [mockSkill1, mockSkill2],
    });

    const result = await orchestrator({
      query: 'AI agents',
      options: { limit: 1 },
    });

    expect(result.papers).toHaveLength(1);
  });

  it('should handle skill failures gracefully', async () => {
    const failingSkill: PaperSearchSkill = {
      id: 'failing',
      name: 'Failing Skill',
      description: 'Throws error',
      search: vi.fn().mockRejectedValue(new Error('API error')),
      resolveByDoi: vi.fn(),
    };

    const orchestrator = createPaperSearchOrchestrator({
      skills: [mockSkill1, failingSkill],
    });

    const result = await orchestrator({
      query: 'AI agents',
      options: { limit: 10 },
    });

    // Should still return results from working skill
    expect(result.papers).toHaveLength(1);
    expect(result.sourcesQueried).toContain('skill1');
  });

  it('should filter by date window', async () => {
    const orchestrator = createPaperSearchOrchestrator({
      skills: [mockSkill1, mockSkill2],
    });

    const result = await orchestrator({
      query: 'AI agents',
      options: {
        limit: 10,
        absoluteDateWindow: {
          startDate: '2023-02-01',
          endDate: '2023-12-31',
          strict: true,
        },
      },
    });

    // Should exclude Paper 1 (2023-01-15) which is before window
    expect(result.papers).toHaveLength(1);
    expect(result.papers[0].publicationDate).toBe('2023-02-20');
  });

  it('should track sources queried', async () => {
    const orchestrator = createPaperSearchOrchestrator({
      skills: [mockSkill1, mockSkill2],
    });

    const result = await orchestrator({
      query: 'AI agents',
      options: { limit: 10 },
    });

    expect(result.sourcesQueried).toHaveLength(2);
    expect(result.sourcesQueried).toContain('skill1');
    expect(result.sourcesQueried).toContain('skill2');
  });
});
