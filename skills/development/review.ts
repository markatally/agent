import { Skill } from '../index';

export const reviewSkill: Skill = {
  name: 'review',
  description: 'Review code for issues, bugs, and improvements',
  aliases: ['cr', 'code-review', 'check'],
  category: 'development',
  requiredTools: ['file_reader', 'code_analyzer'],
  parameters: [
    {
      name: 'target',
      description: 'File, directory, or git diff to review',
      required: true,
      type: 'string',
    },
    {
      name: 'strict',
      description: 'Enable strict mode for more thorough review',
      required: false,
      type: 'boolean',
      default: false,
    },
  ],
  systemPrompt: `You are a senior code reviewer. Provide thorough, constructive feedback on code quality.

Review checklist:
1. **Correctness**: Logic errors, edge cases, null handling
2. **Security**: Injection, XSS, authentication, secrets exposure
3. **Performance**: N+1 queries, unnecessary loops, memory leaks
4. **Readability**: Naming, structure, comments, complexity
5. **Maintainability**: Coupling, cohesion, testability
6. **Best Practices**: Language idioms, framework patterns
7. **Error Handling**: Proper try/catch, error messages, recovery
8. **Types**: Type safety, proper interfaces, avoid 'any'

Feedback format:
- 🔴 Critical: Must fix before merge (bugs, security issues)
- 🟡 Warning: Should fix (bad practices, potential issues)
- 🟢 Suggestion: Nice to have (improvements, style)
- 💡 Note: Educational comment (explanation, alternative approach)

Be specific:
- Point to exact lines
- Explain WHY something is problematic
- Suggest specific fixes
- Acknowledge good patterns you see`,

  userPromptTemplate: `Review the following code:

Target: {target}

{userInput}

Please provide:
1. Executive summary (overall assessment)
2. Critical issues (must fix)
3. Warnings (should fix)
4. Suggestions (nice to have)
5. Positive observations (good patterns found)`,
};
