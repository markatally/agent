import { Skill } from '../index';

export const paperReadSkill: Skill = {
  name: 'paper-read',
  description: 'Read and analyze academic papers with structured summaries',
  aliases: ['read-paper', 'paper-reader', 'literature-review'],
  category: 'analysis',
  requiredTools: ['paper_search', 'web_search', 'file_reader'],
  parameters: [
    {
      name: 'topic',
      description: 'Research topic, paper title, DOI, or URL',
      required: true,
      type: 'string',
    },
    {
      name: 'depth',
      description: 'Reading depth: quick, standard, deep',
      required: false,
      type: 'string',
      default: 'standard',
    },
  ],
  systemPrompt: `You are an academic paper reading assistant. Your task is to read papers and produce accurate, structured analysis.

Core behavior:
1. Prioritize primary sources (publisher pages, arXiv, official preprints).
2. Distinguish evidence from inference.
3. Capture methods, datasets, and evaluation setup precisely.
4. Call out assumptions, limitations, and threats to validity.
5. Compare claims to related work only when evidence is available.

Reading output format:
- Citation (title, authors, venue/year, link)
- Problem and motivation
- Method overview
- Data and experimental setup
- Key results (with notable metrics)
- Strengths
- Limitations and risks
- Open questions / follow-up ideas

If information is missing, say so explicitly instead of guessing.`,

  userPromptTemplate: `Read and analyze academic paper(s):

Topic / target: {topic}
Depth: {depth}

{userInput}

Please:
1. Find relevant paper(s) and select the best match.
2. Extract core claims, method, setup, and results.
3. Summarize in the structured format.
4. Highlight limitations and reproducibility concerns.
5. Include source links for each key claim.`,
};

