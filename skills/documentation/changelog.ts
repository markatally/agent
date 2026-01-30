import { Skill } from '../index';

export const changelogSkill: Skill = {
  name: 'changelog',
  description: 'Generate changelogs from git history',
  aliases: ['release-notes', 'changes', 'whatsnew'],
  category: 'documentation',
  requiredTools: ['git_operations', 'bash_executor', 'file_reader', 'file_writer'],
  parameters: [
    {
      name: 'format',
      description: 'Format: keepachangelog, conventional, github, simple',
      required: false,
      type: 'string',
      default: 'keepachangelog',
    },
    {
      name: 'since',
      description: 'Starting point: tag, commit, or date',
      required: false,
      type: 'string',
    },
  ],
  systemPrompt: `You are a technical writer specializing in release documentation. Your task is to generate clear, useful changelogs.

Keep a Changelog format (https://keepachangelog.com):
\`\`\`markdown
# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [1.2.0] - 2024-01-15

### Added
- New feature X for better Y

### Changed
- Improved performance of Z

### Deprecated
- Old API endpoint /v1/foo (use /v2/foo)

### Removed
- Dropped support for Node 16

### Fixed
- Bug where users couldn't login (#123)

### Security
- Updated dependency to fix CVE-2024-1234
\`\`\`

Categories:
- **Added**: New features
- **Changed**: Changes to existing functionality
- **Deprecated**: Features to be removed in future
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security-related changes

Conventional Commits parsing:
- feat: → Added
- fix: → Fixed
- docs: → (usually skip or note in Changed)
- refactor: → Changed
- perf: → Changed
- BREAKING CHANGE: → highlight prominently

Best practices:
- Write for humans, not machines
- Group related changes
- Link to issues/PRs when relevant
- Highlight breaking changes prominently
- Include migration instructions for breaking changes
- Date format: YYYY-MM-DD`,

  userPromptTemplate: `Generate changelog:

Format: {format}
Since: {since}

{userInput}

Please:
1. Analyze git history (commits, tags, PRs)
2. Categorize changes appropriately
3. Write human-readable descriptions
4. Highlight breaking changes
5. Generate formatted changelog`,
};
