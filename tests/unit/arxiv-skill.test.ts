/**
 * ArXiv Skill Tests
 * 
 * Tests for arXiv API integration and paper search
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ArxivSearchSkill } from '../../apps/api/src/services/paper-search/arxiv-skill';
import type { PaperSearchSkillOptions } from '../../apps/api/src/services/paper-search/types';

describe('ArXiv Skill', () => {
  const mockXMLResponse = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2301.12345v1</id>
    <title>Test Paper Title</title>
    <summary>This is a test abstract</summary>
    <published>2023-01-15T00:00:00Z</published>
    <author><name>John Doe</name></author>
    <author><name>Jane Smith</name></author>
  </entry>
  <entry>
    <id>http://arxiv.org/abs/2302.67890v2</id>
    <title>Another Test Paper</title>
    <summary>Another abstract</summary>
    <published>2023-02-20T00:00:00Z</published>
    <author><name>Alice Johnson</name></author>
  </entry>
</feed>`;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('search', () => {
    it('should fetch and parse arXiv results', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => mockXMLResponse,
      });

      const options: PaperSearchSkillOptions = {
        limit: 10,
        sortBy: 'relevance',
      };

      const results = await ArxivSearchSkill.search('AI agents', options);

      expect(results).toHaveLength(2);
      expect(results[0].title).toBe('Test Paper Title');
      expect(results[0].abstract).toBe('This is a test abstract');
      expect(results[0].authors).toEqual(['John Doe', 'Jane Smith']);
      expect(results[0].publicationDate).toBe('2023-01-15');
      expect(results[0].source).toBe('arxiv');
      expect(results[0].url).toContain('arxiv.org/abs/2301.12345');
    });

    it('should strip version numbers from arXiv IDs', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => mockXMLResponse,
      });

      const options: PaperSearchSkillOptions = { limit: 10 };
      const results = await ArxivSearchSkill.search('test', options);

      // Check that v1 is stripped from URL
      expect(results[0].url).not.toContain('v1');
      expect(results[0].url).toContain('2301.12345');
    });

    it('should handle multi-word queries correctly', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => mockXMLResponse,
      });

      const options: PaperSearchSkillOptions = { limit: 10 };
      await ArxivSearchSkill.search('AI agents multi word', options);

      const callUrl = (global.fetch as any).mock.calls[0][0];
      // Should have all:AI+AND+all:agents+AND+all:multi+AND+all:word
      expect(callUrl).toContain('all:AI');
      expect(callUrl).toContain('all:agents');
      expect(callUrl).toContain('+AND+');
    });

    it('should apply date range filter with absoluteDateWindow', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => mockXMLResponse,
      });

      const options: PaperSearchSkillOptions = {
        limit: 10,
        absoluteDateWindow: {
          startDate: '2023-01-01',
          endDate: '2023-12-31',
          strict: true,
        },
      };

      await ArxivSearchSkill.search('test', options);

      const callUrl = (global.fetch as any).mock.calls[0][0];
      // Should include date filter with URL-encoded brackets
      expect(callUrl).toContain('submittedDate:%5B');
      expect(callUrl).toContain('202301010000');
      expect(callUrl).toContain('202312312359');
    });

    it('should parse legacy dateRange string', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => mockXMLResponse,
      });

      const options: PaperSearchSkillOptions = {
        limit: 10,
        dateRange: 'last-12-months',
      };

      await ArxivSearchSkill.search('test', options);

      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl).toContain('submittedDate');
    });

    it('should parse year range in dateRange', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => mockXMLResponse,
      });

      const options: PaperSearchSkillOptions = {
        limit: 10,
        dateRange: '2020-2023',
      };

      await ArxivSearchSkill.search('test', options);

      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl).toContain('202001010000');
      expect(callUrl).toContain('202312312359');
    });

    it('should parse single year in dateRange', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => mockXMLResponse,
      });

      const options: PaperSearchSkillOptions = {
        limit: 10,
        dateRange: '2023',
      };

      await ArxivSearchSkill.search('test', options);

      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl).toContain('202301010000');
      expect(callUrl).toContain('202312312359');
    });

    it('should apply sort parameter', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => mockXMLResponse,
      });

      const options: PaperSearchSkillOptions = {
        limit: 10,
        sortBy: 'date',
      };

      await ArxivSearchSkill.search('test', options);

      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl).toContain('sortBy=submittedDate');
      expect(callUrl).toContain('sortOrder=descending');
    });

    it('should respect limit parameter', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => mockXMLResponse,
      });

      const options: PaperSearchSkillOptions = {
        limit: 5,
      };

      await ArxivSearchSkill.search('test', options);

      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl).toContain('max_results=5');
    });

    it('should cap limit at 100', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => mockXMLResponse,
      });

      const options: PaperSearchSkillOptions = {
        limit: 500,
      };

      await ArxivSearchSkill.search('test', options);

      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl).toContain('max_results=100');
    });

    it('should return empty array on fetch error', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
      });

      const options: PaperSearchSkillOptions = { limit: 10 };
      const results = await ArxivSearchSkill.search('test', options);

      expect(results).toEqual([]);
    });

    it('should handle malformed XML gracefully', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => '<invalid>xml</structure>',
      });

      const options: PaperSearchSkillOptions = { limit: 10 };
      const results = await ArxivSearchSkill.search('test', options);

      expect(results).toEqual([]);
    });

    it('should handle entries missing required fields', async () => {
      const incompleteXML = `<?xml version="1.0"?>
<feed>
  <entry>
    <summary>Has summary but no title or ID</summary>
  </entry>
  <entry>
    <id>http://arxiv.org/abs/2301.12345v1</id>
    <title>Valid Entry</title>
    <summary>This should be parsed</summary>
    <published>2023-01-15T00:00:00Z</published>
    <author><name>Author</name></author>
  </entry>
</feed>`;

      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => incompleteXML,
      });

      const options: PaperSearchSkillOptions = { limit: 10 };
      const results = await ArxivSearchSkill.search('test', options);

      // Should only parse the valid entry
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Valid Entry');
    });

    it('should strip HTML from text fields', async () => {
      const htmlXML = `<?xml version="1.0"?>
<feed>
  <entry>
    <id>http://arxiv.org/abs/2301.12345v1</id>
    <title>Title with &lt;b&gt;HTML&lt;/b&gt;</title>
    <summary>Abstract with &amp; symbols</summary>
    <published>2023-01-15T00:00:00Z</published>
    <author><name>Author &lt;email@test.com&gt;</name></author>
  </entry>
</feed>`;

      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => htmlXML,
      });

      const options: PaperSearchSkillOptions = { limit: 10 };
      const results = await ArxivSearchSkill.search('test', options);

      expect(results[0].title).toBe('Title with <b>HTML</b>');
      expect(results[0].abstract).toBe('Abstract with & symbols');
    });

    it('should handle invalid publication dates', async () => {
      const invalidDateXML = `<?xml version="1.0"?>
<feed>
  <entry>
    <id>http://arxiv.org/abs/2301.12345v1</id>
    <title>Paper with invalid date</title>
    <summary>Abstract</summary>
    <published>not-a-date</published>
    <author><name>Author</name></author>
  </entry>
</feed>`;

      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => invalidDateXML,
      });

      const options: PaperSearchSkillOptions = { limit: 10 };
      const results = await ArxivSearchSkill.search('test', options);

      expect(results[0].publicationDate).toBeNull();
    });

    it('should include publicationDateSource', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => mockXMLResponse,
      });

      const options: PaperSearchSkillOptions = { limit: 10 };
      const results = await ArxivSearchSkill.search('test', options);

      expect(results[0].publicationDateSource).toBe('arxiv_v1');
    });
  });

  describe('resolveByDoi', () => {
    it('should return null (not supported)', async () => {
      const result = await ArxivSearchSkill.resolveByDoi('10.1234/test');
      expect(result).toBeNull();
    });
  });
});
