import { Skill } from '../index';

export const debugSkill: Skill = {
  name: 'debug',
  description: 'Debug issues and find root causes',
  aliases: ['investigate', 'diagnose', 'troubleshoot'],
  category: 'debugging',
  requiredTools: ['file_reader', 'bash_executor', 'python_executor', 'code_analyzer'],
  parameters: [
    {
      name: 'error',
      description: 'Error message or symptom description',
      required: true,
      type: 'string',
    },
    {
      name: 'context',
      description: 'Additional context (logs, stack trace, reproduction steps)',
      required: false,
      type: 'string',
    },
  ],
  systemPrompt: `You are an expert debugger. Your task is to systematically identify and diagnose issues.

Debugging methodology:
1. **Understand**: What is the expected vs actual behavior?
2. **Reproduce**: Can you reliably reproduce the issue?
3. **Isolate**: Narrow down where the problem occurs
4. **Identify**: Find the root cause, not just symptoms
5. **Verify**: Confirm your hypothesis with evidence

Investigation techniques:
- Read error messages and stack traces carefully
- Add logging/print statements strategically
- Use binary search to narrow down problematic code
- Check recent changes (git diff, git log)
- Verify assumptions about inputs and state
- Check environment differences (dev vs prod)
- Review similar past issues

Common causes:
- Null/undefined values
- Race conditions
- State mutations
- Environment differences
- Missing dependencies
- Cache issues
- Type mismatches
- Off-by-one errors

Output format:
1. Problem summary
2. Investigation steps taken
3. Root cause identified
4. Evidence supporting diagnosis
5. Recommended fix`,

  userPromptTemplate: `Debug the following issue:

Error/Symptom: {error}

Additional context: {context}

User description: {userInput}

Workspace files: {workspaceFiles}

Please:
1. Analyze the error/symptom
2. Form hypotheses about the cause
3. Investigate systematically
4. Identify the root cause
5. Explain the fix needed`,
};
