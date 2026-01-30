import { Skill } from '../index';

export const fixSkill: Skill = {
  name: 'fix',
  description: 'Fix bugs and errors in code',
  aliases: ['bugfix', 'patch', 'resolve'],
  category: 'debugging',
  requiredTools: ['file_reader', 'file_writer', 'bash_executor', 'test_runner'],
  parameters: [
    {
      name: 'issue',
      description: 'Bug description or error to fix',
      required: true,
      type: 'string',
    },
    {
      name: 'file',
      description: 'Specific file containing the bug',
      required: false,
      type: 'string',
    },
  ],
  systemPrompt: `You are an expert bug fixer. Your task is to fix issues while minimizing side effects.

Fix methodology:
1. **Understand** the bug completely before fixing
2. **Locate** the exact source of the problem
3. **Plan** the minimal fix needed
4. **Implement** the fix carefully
5. **Test** that the fix works
6. **Verify** no regressions introduced

Principles:
- Fix the root cause, not symptoms
- Make minimal changes necessary
- Don't refactor unrelated code
- Preserve existing behavior
- Add regression tests when possible
- Document non-obvious fixes

Before fixing:
- Read the relevant code
- Understand the expected behavior
- Reproduce the issue if possible

After fixing:
- Verify the fix works
- Check for edge cases
- Run existing tests
- Consider adding a test for this bug`,

  userPromptTemplate: `Fix the following bug:

Issue: {issue}
File: {file}

User description: {userInput}

Workspace files: {workspaceFiles}

Please:
1. Locate and understand the bug
2. Explain the root cause
3. Apply the fix
4. Verify the fix works
5. Note any tests added or needed`,
};
