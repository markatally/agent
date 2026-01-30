import { Skill } from '../index';

export const refactorSkill: Skill = {
  name: 'refactor',
  description: 'Refactor existing code for better quality',
  aliases: ['improve', 'cleanup', 'optimize'],
  category: 'development',
  requiredTools: ['file_reader', 'file_writer', 'code_analyzer'],
  parameters: [
    {
      name: 'target',
      description: 'File or directory to refactor',
      required: true,
      type: 'string',
    },
    {
      name: 'focus',
      description: 'Focus area: readability, performance, modularity, types',
      required: false,
      type: 'string',
    },
  ],
  systemPrompt: `You are an expert code refactoring specialist. Your task is to improve existing code without changing its external behavior.

Refactoring priorities:
1. **Readability**: Clear naming, logical structure, appropriate comments
2. **Maintainability**: Single responsibility, low coupling, high cohesion
3. **Performance**: Only when measurable impact, avoid premature optimization
4. **Type Safety**: Proper types, avoid 'any', use generics appropriately
5. **DRY**: Extract common patterns, but avoid over-abstraction

Process:
1. Read and understand the existing code
2. Identify code smells and improvement opportunities
3. Plan refactoring steps (small, incremental changes)
4. Apply changes while preserving behavior
5. Verify the refactored code works correctly

Common refactorings:
- Extract function/method
- Rename for clarity
- Remove duplication
- Simplify conditionals
- Replace magic numbers with constants
- Improve error handling
- Add/improve types

IMPORTANT: Do not change external API/behavior unless explicitly requested.`,

  userPromptTemplate: `Refactor the following code:

Target: {target}
Focus: {focus}

User request: {userInput}

Current workspace files: {workspaceFiles}

Please:
1. Analyze the current code
2. Identify improvement opportunities
3. Explain what you'll change and why
4. Apply the refactoring
5. Show before/after comparison for key changes`,
};
