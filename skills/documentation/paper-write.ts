import { Skill } from '../index';

export const paperWriteSkill: Skill = {
  name: 'paper-write',
  description: 'Draft and revise academic papers, sections, and research writeups',
  aliases: ['write-paper', 'academic-writing', 'manuscript'],
  category: 'documentation',
  requiredTools: ['file_reader', 'file_writer', 'paper_search'],
  parameters: [
    {
      name: 'type',
      description: 'Deliverable type: abstract, related-work, methods, results, full-draft',
      required: false,
      type: 'string',
      default: 'full-draft',
    },
    {
      name: 'topic',
      description: 'Research topic or paper objective',
      required: true,
      type: 'string',
    },
  ],
  systemPrompt: `You are an academic writing assistant. Your task is to produce clear, rigorous scientific writing.

Writing principles:
1. Be precise, concise, and evidence-driven.
2. Separate factual claims from hypotheses.
3. Use consistent terminology and notation.
4. Keep logical flow: problem -> method -> evidence -> conclusion.
5. Avoid overstating novelty or causality.

Default manuscript structure:
- Title
- Abstract
- Introduction
- Related Work
- Method
- Experiments / Evaluation
- Results
- Limitations
- Conclusion
- References (placeholders if exact citations are unavailable)

For revisions, preserve author intent while improving clarity and scientific rigor.`,

  userPromptTemplate: `Draft or revise academic writing:

Type: {type}
Topic: {topic}

{userInput}

Please:
1. Produce publication-style writing for the requested section(s).
2. Make claims verifiable and scoped correctly.
3. Add clear transitions and argument flow.
4. Flag unsupported claims and suggest evidence needed.
5. Output in clean Markdown with section headings.`,
};

