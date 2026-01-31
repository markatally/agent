import { Skill } from '../index';

export const searchSkill: Skill = {
  name: 'web_search',
  description: 'Search academic papers from arXiv, alphaXiv, and Google Scholar. Returns normalized metadata (title, authors, date, venue, link, summary) for research and PPT generation.',
  aliases: ['academic', 'papers', 'scholar', 'research', 'arxiv', 'alphaxiv'],
  category: 'web',
  requiredTools: ['web_search'],
  parameters: [
    {
      name: 'query',
      description: 'Search query for finding papers',
      required: true,
      type: 'string',
    },
    {
      name: 'sources',
      description: 'Sources to search: arxiv, alphaxiv, google_scholar, or all (default: all)',
      required: false,
      type: 'string',
      default: 'all',
    },
    {
      name: 'topK',
      description: 'Number of results to return per source (default: 5, max: 20)',
      required: false,
      type: 'number',
      default: 5,
    },
    {
      name: 'dateRange',
      description: 'Date range filter (e.g., "2020-2024", "last-5-years", "last-12-months")',
      required: false,
      type: 'string',
    },
    {
      name: 'sortBy',
      description: 'Sort order: relevance, date, or citations (default: relevance)',
      required: false,
      type: 'string',
      default: 'relevance',
    },
  ],
  systemPrompt: `You are an academic research assistant. Your task is to find relevant academic papers and research materials for users.

Search strategy:
1. Formulate effective search queries based on the topic
2. Use multiple sources when appropriate (arXiv for CS/ML, alphaXiv for AI papers)
3. Evaluate paper relevance based on title, abstract, and date
4. Prioritize recent, high-impact papers
5. Consider citation counts when available

Paper evaluation criteria:
- Relevance: Does the paper directly address the topic?
- Recency: Is the paper recent enough for the topic?
- Quality: Is it published in a reputable venue?
- Citations: Does it have reasonable citation counts?
- Accessibility: Is full text available?

For PPT generation context:
- Extract key contributions and findings
- Identify main authors and their affiliations
- Note publication venue and year
- Summarize methodology if applicable
- Highlight significant results
`,

  userPromptTemplate: `Search for academic papers on the following topic:

Topic: {query}
Sources: {sources || 'all'}
Results per source: {topK || 5}
Date range: {dateRange || 'all time'}
Sort by: {sortBy || 'relevance'}

{userInput}

Please:
1. Execute web_search with the specified parameters
2. Review results and identify the most relevant papers
3. Summarize key findings from the top 3-5 papers
4. Organize results by relevance and recency
5. Highlight papers that would be good sources for a PPT presentation
6. Provide a structured summary including:
   - Paper title and authors
   - Publication venue and date
   - Key contributions (brief)
   - Direct link to the paper
7. Note any limitations or gaps in the search results
`,
};
