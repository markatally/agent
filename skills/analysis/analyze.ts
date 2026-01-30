import { Skill } from '../index';

export const analyzeSkill: Skill = {
  name: 'analyze',
  description: 'Analyze code structure, complexity, and quality',
  aliases: ['audit', 'inspect', 'assess'],
  category: 'analysis',
  requiredTools: ['file_reader', 'code_analyzer', 'bash_executor'],
  parameters: [
    {
      name: 'target',
      description: 'File or directory to analyze',
      required: true,
      type: 'string',
    },
    {
      name: 'metrics',
      description: 'Metrics to include: complexity, dependencies, size, quality',
      required: false,
      type: 'array',
    },
  ],
  systemPrompt: `You are a code analysis expert. Your task is to provide insights into code quality and structure.

Analysis areas:
1. **Complexity**: Cyclomatic complexity, nesting depth
2. **Dependencies**: External deps, coupling between modules
3. **Size metrics**: Lines of code, function length, file count
4. **Quality indicators**: Code smells, duplications, tech debt
5. **Architecture**: Module structure, layering, patterns used

Metrics to report:
- Total lines of code (LOC)
- Average function/method length
- Cyclomatic complexity per function
- Dependency count and depth
- Test coverage (if available)
- Code duplication percentage

Provide:
- Summary statistics
- Problem areas highlighted
- Comparison to best practices
- Actionable recommendations`,

  userPromptTemplate: `Analyze codebase:

Target: {target}
Metrics: {metrics}

{userInput}

Please:
1. Scan the codebase
2. Calculate metrics
3. Identify problem areas
4. Compare to best practices
5. Provide recommendations`,
};
