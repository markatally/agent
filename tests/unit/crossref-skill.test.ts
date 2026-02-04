/**
 * CrossRef Skill Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CrossRefResolverSkill } from '../../apps/api/src/services/paper-search/crossref-skill';

describe('CrossRef Skill', () => {
  const mockAPIResponse = {
    message: {
      title: ['Test Paper Title'],
      author: [
        { given: 'John', family: 'Doe' },
        { given: 'Jane', family: 'Smith' },
      ],
      abstract: '<p>Test abstract</p>',
      'container-title': ['Test Journal'],
      published: {
        'date-parts': [[2023, 6, 15]],
      },
      DOI: '10.1234/test',
      URL: 'https://doi.org/10.1234/test',
    },
  };

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should resolve DOI successfully', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockAPIResponse,
    });

    const result = await CrossRefResolverSkill.resolveByDoi('10.1234/test');

    expect(result).toBeDefined();
    expect(result?.title).toBe('Test Paper Title');
    expect(result?.authors).toEqual(['John Doe', 'Jane Smith']);
    expect(result?.publicationDate).toBe('2023-06-15');
    expect(result?.doi).toBe('10.1234/test');
    expect(result?.publicationDateSource).toBe('crossref');
  });

  it('should normalize DOI by removing https://doi.org/ prefix', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockAPIResponse,
    });

    await CrossRefResolverSkill.resolveByDoi('https://doi.org/10.1234/test');

    const callUrl = (global.fetch as any).mock.calls[0][0];
    expect(callUrl).toContain('works/10.1234/test');
    expect(callUrl).not.toContain('https://doi.org');
  });

  it('should handle date priority: published first', async () => {
    const responseWithMultipleDates = {
      message: {
        ...mockAPIResponse.message,
        published: { 'date-parts': [[2023, 6, 15]] },
        'published-print': { 'date-parts': [[2023, 7, 1]] },
        'published-online': { 'date-parts': [[2023, 5, 1]] },
      },
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => responseWithMultipleDates,
    });

    const result = await CrossRefResolverSkill.resolveByDoi('10.1234/test');
    expect(result?.publicationDate).toBe('2023-06-15'); // published takes priority
  });

  it('should fallback to published-print if no published date', async () => {
    const response = {
      message: {
        ...mockAPIResponse.message,
        published: undefined,
        'published-print': { 'date-parts': [[2023, 7, 1]] },
      },
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => response,
    });

    const result = await CrossRefResolverSkill.resolveByDoi('10.1234/test');
    expect(result?.publicationDate).toBe('2023-07-01');
  });

  it('should fallback to published-online if no other dates', async () => {
    const response = {
      message: {
        ...mockAPIResponse.message,
        published: undefined,
        'published-print': undefined,
        'published-online': { 'date-parts': [[2023, 5, 1]] },
      },
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => response,
    });

    const result = await CrossRefResolverSkill.resolveByDoi('10.1234/test');
    expect(result?.publicationDate).toBe('2023-05-01');
  });

  it('should handle partial dates (missing day)', async () => {
    const response = {
      message: {
        ...mockAPIResponse.message,
        published: { 'date-parts': [[2023, 6]] }, // Only year and month
      },
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => response,
    });

    const result = await CrossRefResolverSkill.resolveByDoi('10.1234/test');
    expect(result?.publicationDate).toBe('2023-06-01'); // Defaults to 01
  });

  it('should handle partial dates (year only)', async () => {
    const response = {
      message: {
        ...mockAPIResponse.message,
        published: { 'date-parts': [[2023]] }, // Only year
      },
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => response,
    });

    const result = await CrossRefResolverSkill.resolveByDoi('10.1234/test');
    expect(result?.publicationDate).toBe('2023-01-01');
  });

  it('should extract title from array', async () => {
    const response = {
      message: {
        ...mockAPIResponse.message,
        title: ['First Title', 'Alternate Title'],
      },
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => response,
    });

    const result = await CrossRefResolverSkill.resolveByDoi('10.1234/test');
    expect(result?.title).toBe('First Title'); // Takes first title
  });

  it('should handle missing author fields gracefully', async () => {
    const response = {
      message: {
        ...mockAPIResponse.message,
        author: [
          { family: 'Doe' }, // No given name
          { given: 'Jane', family: 'Smith' },
        ],
      },
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => response,
    });

    const result = await CrossRefResolverSkill.resolveByDoi('10.1234/test');
    expect(result?.authors).toContain('Doe');
    expect(result?.authors).toContain('Jane Smith');
  });

  it('should return null on fetch error', async () => {
    (global.fetch as any).mockResolvedValue({ ok: false });

    const result = await CrossRefResolverSkill.resolveByDoi('10.1234/test');
    expect(result).toBeNull();
  });

  it('should return null on exception', async () => {
    (global.fetch as any).mockRejectedValue(new Error('Network error'));

    const result = await CrossRefResolverSkill.resolveByDoi('10.1234/test');
    expect(result).toBeNull();
  });

  it('should not support search', async () => {
    const results = await CrossRefResolverSkill.search('test', { limit: 10 });
    expect(results).toEqual([]);
  });
});
