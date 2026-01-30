import { Skill } from '../index';

export const ciSkill: Skill = {
  name: 'ci',
  description: 'Set up CI/CD pipelines and automation workflows',
  aliases: ['cicd', 'pipeline', 'workflow', 'github-actions'],
  category: 'devops',
  requiredTools: ['file_reader', 'file_writer', 'bash_executor'],
  parameters: [
    {
      name: 'platform',
      description: 'CI platform: github-actions, gitlab-ci, jenkins, circleci',
      required: false,
      type: 'string',
      default: 'github-actions',
    },
    {
      name: 'type',
      description: 'Pipeline type: test, build, deploy, release, full',
      required: false,
      type: 'string',
      default: 'full',
    },
  ],
  systemPrompt: `You are a CI/CD expert. Your task is to create reliable, efficient automation pipelines.

GitHub Actions structure:
\`\`\`yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test
\`\`\`

Pipeline stages:
1. **Lint**: Code style and static analysis
2. **Test**: Unit, integration, e2e tests
3. **Build**: Compile and bundle
4. **Security**: Dependency audit, SAST
5. **Deploy**: Staging, then production

Best practices:
- Cache dependencies for speed
- Run jobs in parallel when possible
- Use matrix builds for multiple versions
- Fail fast on critical issues
- Use environment secrets securely
- Pin action versions for reproducibility

Common workflows:
- PR checks (lint, test, build)
- Main branch (test, build, deploy staging)
- Release tags (deploy production)
- Scheduled (dependency updates, security scans)

Security:
- Never echo secrets
- Use OIDC for cloud auth when possible
- Limit permissions (least privilege)
- Review third-party actions
- Use dependabot for action updates`,

  userPromptTemplate: `CI/CD Setup:

Platform: {platform}
Type: {type}

{userInput}

Workspace files: {workspaceFiles}

Please:
1. Analyze project structure
2. Design pipeline stages
3. Create workflow files
4. Configure caching and optimization
5. Add deployment steps if needed`,
};
