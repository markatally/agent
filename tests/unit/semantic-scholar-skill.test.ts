/**
 * Semantic Scholar Skill Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SemanticScholarSkill } from '../../apps/api/src/services/paper-search/semantic-scholar-skill';
import type { PaperSearchSkillOptions } from '../../apps/api/src/services/paper-search/types';

describe('Semantic Scholar Skill', () => {
  const mockAPIResponse = {
    data: [
      {
        paperId: 'abc123',
        title: 'Test Paper',
        abstract: 'Test abstract',
        year: 2023,
        authors: [
          { name: 'John Doe' },
          { name: 'Jane Smith' },
        ],
        venue: 'Test Conference',
        url: 'https://example.com/paper',
        citationCount: 42,
        externalIds: {
          DOI: '10.1234/test',
          ArXiv: '2301.12345',
        },
      },
    ],
  };

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch and parse results', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockAPIResponse,
    });

    const options: PaperSearchSkillOptions = { limit: 10 };
    const results = await SemanticScholarSkill.search('AI agents', options);

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Test Paper');
    expect(results[0].authors).toEqual(['John Doe', 'Jane Smith']);
    expect(results[0].publicationDate).toBe('2023-01-01');
    expect(results[0].citationCount).toBe(42);
    expect(results[0].doi).toBe('10.1234/test');
  });

  it('should apply year filter from absoluteDateWindow', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    const options: PaperSearchSkillOptions = {
      limit: 10,
      absoluteDateWindow: {
        startDate: '2020-01-01',
        endDate: '2023-12-31',
        strict: true,
      },
    };

    await SemanticScholarSkill.search('test', options);

    const callUrl = (global.fetch as any).mock.calls[0][0];
    expect(callUrl).toContain('year=2020-2023');
  });

  it('should map sort parameters correctly', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    await SemanticScholarSkill.search('test', { limit: 10, sortBy: 'citations' });

    const callUrl = (global.fetch as any).mock.calls[0][0];
    expect(callUrl).toContain('citationCount');
  });

  it('should return empty array on fetch error', async () => {
    (global.fetch as any).mockResolvedValue({ ok: false });

    const results = await SemanticScholarSkill.search('test', { limit: 10 });
    expect(results).toEqual([]);
  });

  it('should handle missing DOI', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{
          paperId: 'abc',
          title: 'Test',
          year: 2023,
          authors: [],
          externalIds: {},
        }],
      }),
    });

    const results = await SemanticScholarSkill.search('test', { limit: 10 });
    expect(results[0].doi).toBeUndefined();
  });

  it('should use paper ID as fallback URL', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{
          paperId: 'abc123',
          title: 'Test',
          year: 2023,
          authors: [],
          url: null,
        }],
      }),
    });

    const results = await SemanticScholarSkill.search('test', { limit: 10 });
    expect(results[0].url).toContain('abc123');
  });

  it('should not support DOI resolution', async () => {
    const result = await SemanticScholarSkill.resolveByDoi('10.1234/test');
    expect(result).toBeNull();
  });
});
