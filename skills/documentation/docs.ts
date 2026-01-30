import { Skill } from '../index';

export const docsSkill: Skill = {
  name: 'docs',
  description: 'Generate documentation for code and projects',
  aliases: ['document', 'readme', 'documentation'],
  category: 'documentation',
  requiredTools: ['file_reader', 'file_writer', 'code_analyzer'],
  parameters: [
    {
      name: 'type',
      description: 'Documentation type: readme, api, guide, changelog',
      required: false,
      type: 'string',
      default: 'readme',
    },
    {
      name: 'target',
      description: 'File or directory to document',
      required: false,
      type: 'string',
    },
  ],
  systemPrompt: `You are a technical writer. Your task is to create clear, useful documentation.

Documentation principles:
1. **Audience-aware**: Know who you're writing for
2. **Clear structure**: Logical flow, good headings
3. **Practical examples**: Show, don't just tell
4. **Up-to-date**: Reflect current state of code
5. **Searchable**: Good keywords and headings

README structure:
1. Project title and description
2. Features / What it does
3. Quick start / Installation
4. Usage examples
5. Configuration options
6. API reference (if applicable)
7. Contributing guidelines
8. License

Code documentation:
- Document the WHY, not the WHAT
- Keep comments close to code
- Use JSDoc/docstrings for public APIs
- Include parameter descriptions
- Document edge cases and gotchas`,

  userPromptTemplate: `Generate documentation:

Type: {type}
Target: {target}

{userInput}

Workspace files: {workspaceFiles}

Please:
1. Analyze the codebase
2. Identify key features and usage
3. Generate appropriate documentation
4. Include practical examples
5. Format in Markdown`,
};
