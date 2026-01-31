/**
 * Web Search Tool
 * Searches academic papers from arXiv, alphaXiv, and Google Scholar
 * Uses open-source APIs and wrappers
 */

import type { Tool, ToolContext, ToolResult } from './types';

/**
 * Search source types
 */
type SearchSource = 'arxiv' | 'alphaxiv' | 'google_scholar' | 'all';

/**
 * Paper metadata
 */
interface PaperMetadata {
  title: string;
  authors: string[];
  date?: string;
  venue?: string;
  link: string;
  summary?: string;
  source: string;
  citations?: number;
}

/**
 * Web Search Tool
 * Searches academic papers from multiple sources
 */
export class WebSearchTool implements Tool {
  name = 'web_search';
  description = 'Search academic papers and web resources from arXiv, alphaXiv, and Google Scholar. Returns normalized metadata including title, authors, date, venue, and links.';
  requiresConfirmation = false;
  timeout = 30000;

  inputSchema = {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string' as const,
        description: 'Search query for finding papers or web resources',
      },
      sources: {
        type: 'string' as const,
        description: 'Sources to search: arxiv, alphaxiv, google_scholar, all (default: all)',
        enum: ['arxiv', 'alphaxiv', 'google_scholar', 'all'],
      },
      topK: {
        type: 'number' as const,
        description: 'Number of results to return per source (default: 5, max: 20)',
        minimum: 1,
        maximum: 20,
      },
      dateRange: {
        type: 'string' as const,
        description: 'Optional date range filter (e.g., "2020-2024", "last-5-years", "last-12-months")',
      },
      sortBy: {
        type: 'string' as const,
        description: 'Sort order: relevance, date, citations (default: relevance)',
        enum: ['relevance', 'date', 'citations'],
      },
    },
    required: ['query'],
  };

  constructor(private context: ToolContext) {}

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const query = params.query as string;
      const sources = (params.sources as SearchSource) || 'all';
      const topK = Math.min(Math.max((params.topK as number) || 5, 1), 20);
      const sortBy = (params.sortBy as string) || 'relevance';
      const dateRange = params.dateRange as string | undefined;

      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return {
          success: false,
          output: '',
          error: 'Query is required and must be a non-empty string',
          duration: Date.now() - startTime,
        };
      }

      // Determine which sources to search
      const sourcesToSearch: SearchSource[] = sources === 'all'
        ? ['arxiv', 'alphaxiv', 'google_scholar']
        : [sources];

      let allResults: PaperMetadata[] = [];

      // Search each source
      for (const source of sourcesToSearch) {
        const results = await this.searchSource(source, query, topK, sortBy, dateRange);
        allResults = allResults.concat(results);
      }

      // Sort results based on sortBy preference
      allResults = this.sortResults(allResults, sortBy);

      // Limit to topK results total
      allResults = allResults.slice(0, topK);

      // Format output
      const output = this.formatResults(allResults, query, sourcesToSearch, sortBy);

      return {
        success: true,
        output,
        duration: Date.now() - startTime,
        artifacts: allResults.length > 0 ? [{
          type: 'data',
          name: 'search-results.json',
          content: JSON.stringify(allResults, null, 2),
          mimeType: 'application/json',
        }] : undefined,
      };
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: error.message || 'Failed to perform web search',
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Search a specific source
   */
  private async searchSource(
    source: SearchSource,
    query: string,
    limit: number,
    sortBy: string,
    dateRange?: string
  ): Promise<PaperMetadata[]> {
    switch (source) {
      case 'arxiv':
        return this.searchArXiv(query, limit, sortBy, dateRange);
      case 'alphaxiv':
        return this.searchAlphaXiv(query, limit, sortBy);
      case 'google_scholar':
        return this.searchGoogleScholar(query, limit);
      default:
        return [];
    }
  }

  /**
   * Search arXiv API
   * arXiv provides a public API for searching and retrieving papers
   */
  private async searchArXiv(
    query: string,
    limit: number,
    sortBy: string,
    dateRange?: string
  ): Promise<PaperMetadata[]> {
    try {
      // arXiv search API URL
      const baseUrl = 'http://export.arxiv.org/api/query';
      const searchParams = new URLSearchParams({
        search_query: this.buildArXivQuery(query, dateRange),
        start: '0',
        max_results: limit.toString(),
        sortBy: this.mapSortParam(sortBy),
        sortOrder: 'descending',
      });

      const response = await fetch(`${baseUrl}?${searchParams}`, {
        headers: {
          'User-Agent': 'Manus-Agent/1.0',
        },
      });

      if (!response.ok) {
        console.warn(`arXiv API error: ${response.status} ${response.statusText}`);
        return [];
      }

      const text = await response.text();

      // Parse arXiv atom feed
      const results: PaperMetadata[] = [];
      const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
      const entries = text.match(entryRegex) || [];

      for (const entry of entries) {
        const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
        const summaryMatch = entry.match(/<summary>([\s\S]*?)<\/summary>/);
        const authorMatches = entry.matchAll(/<name>([\s\S]*?)<\/name>/g);
        const publishedMatch = entry.match(/<published>([\s\S]*?)<\/published>/);
        const idMatch = entry.match(/<id>([\s\S]*?)<\/id>/);

        if (titleMatch && idMatch) {
          const title = this.stripHtml(titleMatch[1]);
          const authors = authorMatches.map(m => this.stripHtml(m[1])).filter(a => a.trim());
          const published = publishedMatch ? publishedMatch[1] : '';
          const date = published ? new Date(published).toISOString().split('T')[0] : '';
          const arxivId = idMatch[1].split('/').pop();
          const link = `https://arxiv.org/abs/${arxivId}`;
          const summary = summaryMatch ? this.stripHtml(summaryMatch[1]).substring(0, 500) : '';

          results.push({
            title,
            authors: authors.length > 0 ? authors : ['Unknown'],
            date,
            venue: 'arXiv',
            link,
            summary,
            source: 'arxiv',
          });
        }
      }

      return results;
    } catch (error) {
      console.warn('arXiv search failed:', error);
      return [];
    }
  }

  /**
   * Build arXiv search query with date range
   */
  private buildArXivQuery(query: string, dateRange?: string): string {
    let arxivQuery = `all:${query.replace(/\s+/g, '+')}`;

    if (dateRange) {
      const dateRangeLower = dateRange.toLowerCase();

      if (dateRangeLower.includes('year') || dateRangeLower.match(/\d{4}/)) {
        // Parse year range like "2020-2024"
        const yearMatch = dateRange.match(/(\d{4})-(\d{4})/);
        if (yearMatch) {
          arxivQuery += ` AND submittedDate:[${yearMatch[1]}* TO ${yearMatch[2]}*]`;
        } else if (dateRangeLower.match(/(\d{4})/)) {
          const year = dateRange.match(/(\d{4})/)?.[1];
          if (year) {
            arxivQuery += ` AND submittedDate:[${year}*]`;
          }
        } else if (dateRangeLower.includes('last-')) {
          const match = dateRangeLower.match(/last-(\d+)\s*(years|months|days)/);
          if (match) {
            const num = parseInt(match[1]);
            const unit = match[2];
            arxivQuery += this.addDateFilter(arxivQuery, num, unit);
          }
        }
      }
    }

    return arxivQuery;
  }

  /**
   * Add date filter to arXiv query
   */
  private addDateFilter(query: string, num: number, unit: string): string {
    const now = new Date();
    let startDate: Date;

    if (unit.startsWith('year')) {
      startDate = new Date(now.getFullYear() - num, 0, 1);
    } else if (unit.startsWith('month')) {
      startDate = new Date(now.getFullYear(), now.getMonth() - num, 1);
    } else {
      startDate = new Date(now.getTime() - num * 24 * 60 * 60 * 1000);
    }

    const startYear = startDate.getFullYear();
    const startMonth = String(startDate.getMonth() + 1).padStart(2, '0');
    const startDay = String(startDate.getDate()).padStart(2, '0');

    return `${query} AND submittedDate:[${startYear}${startMonth}${startDay}* TO 99991231*]`;
  }

  /**
   * Search alphaXiv API
   * alphaXiv provides AI/ML paper search with ML relevance ranking
   */
  private async searchAlphaXiv(
    query: string,
    limit: number,
    sortBy: string
  ): Promise<PaperMetadata[]> {
    try {
      const baseUrl = 'https://www.alphaxiv.org/api/ask';
      const searchParams = new URLSearchParams({
        q: `"${query}"`,
        // Use AI search for better relevance
        moderators: ',default',
        pretty: 'true',
        skip_ai: 'true',
      });

      const response = await fetch(`${baseUrl}?${searchParams}`, {
        headers: {
          'User-Agent': 'Manus-Agent/1.0',
        },
      });

      if (!response.ok) {
        console.warn(`alphaXiv API error: ${response.status} ${response.statusText}`);
        return [];
      }

      const data = await response.json();

      if (!data.completions || data.completions.length === 0) {
        return [];
      }

      const results: PaperMetadata[] = [];

      // alphaXiv returns sorted results from multiple sources
      const completions = data.completions.slice(0, limit);

      for (const completion of completions) {
        if (completion.paper) {
          results.push({
            title: completion.paper.title || 'Untitled',
            authors: completion.paper.authors || [],
            date: completion.paper.published_date || undefined,
            venue: completion.paper.venue || completion.pdf_source || 'alphaXiv',
            link: completion.paper.pdf_url || completion.paper.url || `https://www.alphaxiv.org/paper/${completion.paper.paper_id}`,
            summary: completion.paper.summary || completion.snippet || '',
            source: 'alphaXiv',
          });
        }
      }

      return results;
    } catch (error) {
      console.warn('alphaXiv search failed:', error);
      return [];
    }
  }

  /**
   * Search Google Scholar (using serpapi or similar wrapper)
   * Note: Google Scholar doesn't have a free public API
   * This uses a fallback approach with open-source wrappers
   */
  private async searchGoogleScholar(query: string, limit: number): Promise<PaperMetadata[]> {
    try {
      // Try using Semantic Scholar API (open-source alternative)
      const baseUrl = 'https://api.semanticscholar.org/api/v1/search';
      const searchParams = new URLSearchParams({
        query: query.replace(/\s+/g, '+'),
        limit: limit.toString(),
        fields: 'title,authors,year,venue,url,abstract',
      });

      const response = await fetch(`${baseUrl}?${searchParams}`, {
        headers: {
          'User-Agent': 'Manus-Agent/1.0',
        },
      });

      if (!response.ok) {
        console.warn(`Semantic Scholar API error: ${response.status} ${response.statusText}`);
        return [];
      }

      const data = await response.json();

      if (!data.data || !Array.isArray(data.data)) {
        return [];
      }

      return data.data.map((item: any) => ({
        title: item.title || 'Untitled',
        authors: item.authors || [],
        date: item.year ? String(item.year) : '',
        venue: item.venue || 'Semantic Scholar',
        link: item.url || `https://www.semanticscholar.org/paper/${item.paperId}`,
        summary: item.abstract || '',
        source: 'semantic_scholar',
        citations: item.citationCount,
      }));
    } catch (error) {
      console.warn('Google Scholar/Semantic Scholar search failed:', error);
      return [];
    }
  }

  /**
   * Sort results based on preference
   */
  private sortResults(results: PaperMetadata[], sortBy: string): PaperMetadata[] {
    switch (sortBy) {
      case 'date':
        return results.sort((a, b) => {
          const dateA = a.date ? new Date(a.date).getTime() : 0;
          const dateB = b.date ? new Date(b.date).getTime() : 0;
          return dateB - dateA;
        });
      case 'citations':
        return results.sort((a, b) => {
          const citesA = a.citations || 0;
          const citesB = b.citations || 0;
          return citesB - citesA;
        });
      case 'relevance':
      default:
        // Sort by source priority: arxiv > alphaxiv > others
        const sourcePriority: Record<string, number> = {
          arxiv: 3,
          alphaxiv: 2,
          semantic_scholar: 1,
        };
        return results.sort((a, b) => {
          const priorityA = sourcePriority[a.source] || 0;
          const priorityB = sourcePriority[b.source] || 0;
          return priorityB - priorityA;
        });
    }
  }

  /**
   * Map sort parameter to arXiv sort field
   */
  private mapSortParam(sortBy: string): string {
    const sortMap: Record<string, string> = {
      relevance: 'relevance',
      date: 'submittedDate',
      citations: 'citationCount',
    };
    return sortMap[sortBy] || 'relevance';
  }

  /**
   * Strip HTML tags from text
   */
  private stripHtml(text: string): string {
    return text
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .trim();
  }

  /**
   * Format results as readable output
   */
  private formatResults(
    results: PaperMetadata[],
    query: string,
    sources: SearchSource[],
    sortBy: string
  ): string {
    if (results.length === 0) {
      return `No results found for query: "${query}" from sources: ${sources.join(', ')}`;
    }

    let output = `🔍 Search Results for: "${query}"\n`;
    output += `📊 ${results.length} papers found | Sources: ${sources.join(', ')} | Sort: ${sortBy}\n`;
    output += '='.repeat(60) + '\n\n';

    for (let i = 0; i < results.length; i++) {
      const paper = results[i];
      output += `Result ${i + 1}/${results.length}:\n`;
      output += `📄 Title: ${paper.title}\n`;
      output += `✍️  Authors: ${paper.authors.join(', ')}\n`;

      if (paper.date) {
        output += `📅 Date: ${paper.date}\n`;
      }

      if (paper.venue) {
        output += `🏛️  Venue: ${paper.venue}\n`;
      }

      if (paper.citations) {
        output += `📎 Citations: ${paper.citations}\n`;
      }

      output += `🔗 Link: ${paper.link}\n`;
      output += `📌 Source: ${paper.source}\n`;

      if (paper.summary) {
        output += `\n📝 Summary:\n${paper.summary}\n`;
      }

      output += '\n' + '-'.repeat(40) + '\n\n';
    }

    output += '='.repeat(60);
    output += `\n💡 Tip: Use these results to find relevant papers for your presentation.`;

    return output;
  }
}
