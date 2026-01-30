import { Skill } from '../index';

export const codeSkill: Skill = {
  name: 'code',
  description: 'Generate code based on requirements',
  aliases: ['generate', 'create', 'implement'],
  category: 'development',
  requiredTools: ['file_writer', 'file_reader', 'code_analyzer'],
  parameters: [
    {
      name: 'language',
      description: 'Programming language (auto-detected if not specified)',
      required: false,
      type: 'string',
    },
    {
      name: 'framework',
      description: 'Framework to use (e.g., react, express, fastapi)',
      required: false,
      type: 'string',
    },
  ],
  systemPrompt: `You are an expert software developer. Your task is to generate high-quality, production-ready code.

Follow these principles:
1. Write clean, readable, and maintainable code
2. Follow the language's best practices and conventions
3. Include appropriate error handling
4. Add comments only where the logic is non-obvious
5. Use meaningful variable and function names
6. Keep functions small and focused (single responsibility)
7. Consider edge cases and input validation

Before writing code:
1. Clarify requirements if ambiguous
2. Plan the structure and approach
3. Identify dependencies needed

After writing code:
1. Review for potential bugs
2. Check for security issues
3. Ensure it integrates with existing code`,

  userPromptTemplate: `Generate code for the following requirement:

{userInput}

Context:
- Workspace files: {workspaceFiles}
- Language preference: {language}
- Framework: {framework}

Please:
1. Explain your approach briefly
2. Generate the code
3. Explain how to use it
4. Note any dependencies to install`,
};
