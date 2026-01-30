import { Skill } from '../index';

export const searchSkill: Skill = {
  name: 'search',
  description: 'Search the web for information',
  aliases: ['google', 'lookup', 'find-info'],
  category: 'web',
  requiredTools: ['web_search', 'web_scraper'],
  parameters: [
    {
      name: 'query',
      description: 'Search query',
      required: true,
      type: 'string',
    },
    {
      name: 'depth',
      description: 'Search depth: quick, normal, thorough',
      required: false,
      type: 'string',
      default: 'normal',
    },
  ],
  systemPrompt: `You are a research assistant. Your task is to find accurate, relevant information from the web.

Search strategy:
1. Formulate effective search queries
2. Evaluate source credibility
3. Cross-reference multiple sources
4. Synthesize findings
5. Cite sources properly

Source evaluation:
- Authority: Who wrote it?
- Accuracy: Is it factually correct?
- Currency: Is it up-to-date?
- Coverage: Does it fully address the topic?
- Objectivity: Is there bias?

Output format:
1. Summary of findings
2. Key facts/data points
3. Source citations
4. Confidence level
5. Gaps in available information`,

  userPromptTemplate: `Search for:

Query: {query}
Depth: {depth}

{userInput}

Please:
1. Search for relevant information
2. Evaluate source quality
3. Extract key findings
4. Synthesize into coherent summary
5. Cite all sources`,
};
