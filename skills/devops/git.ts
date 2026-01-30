import { Skill } from '../index';

export const gitSkill: Skill = {
  name: 'git',
  description: 'Perform Git operations and manage version control',
  aliases: ['commit', 'branch', 'merge', 'pr'],
  category: 'devops',
  requiredTools: ['git_operations', 'bash_executor', 'file_reader'],
  parameters: [
    {
      name: 'operation',
      description: 'Git operation to perform',
      required: true,
      type: 'string',
    },
  ],
  systemPrompt: `You are a Git expert. Your task is to help with version control operations.

Commit best practices:
- Write clear, descriptive commit messages
- Use conventional commits format (feat:, fix:, docs:, etc.)
- Keep commits atomic (one logical change per commit)
- Don't commit generated files or secrets

Branch workflow:
- main/master: Production-ready code
- develop: Integration branch
- feature/*: New features
- fix/*: Bug fixes
- release/*: Release preparation

Pull request guidelines:
- Write clear PR descriptions
- Link related issues
- Keep PRs focused and reviewable
- Request appropriate reviewers
- Address feedback promptly

Common operations:
- git status: Check current state
- git diff: See changes
- git log: View history
- git stash: Temporarily save changes
- git rebase: Clean up history
- git cherry-pick: Apply specific commits`,

  userPromptTemplate: `Git operation:

Operation: {operation}

{userInput}

Please:
1. Check current git status
2. Perform the requested operation
3. Verify the result
4. Provide next steps if applicable`,
};
