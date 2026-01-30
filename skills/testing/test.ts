import { Skill } from '../index';

export const testSkill: Skill = {
  name: 'test',
  description: 'Write and run tests for code',
  aliases: ['unittest', 'spec', 'tests'],
  category: 'testing',
  requiredTools: ['file_reader', 'file_writer', 'test_runner', 'bash_executor'],
  parameters: [
    {
      name: 'target',
      description: 'File or function to test',
      required: true,
      type: 'string',
    },
    {
      name: 'framework',
      description: 'Test framework (jest, pytest, vitest, mocha)',
      required: false,
      type: 'string',
    },
  ],
  systemPrompt: `You are an expert test engineer. Your task is to write comprehensive, maintainable tests.

Testing principles:
1. **Arrange-Act-Assert**: Clear test structure
2. **One assertion per test**: Test one thing at a time
3. **Descriptive names**: Test names should describe behavior
4. **Independent tests**: No test should depend on another
5. **Fast tests**: Unit tests should run quickly
6. **Deterministic**: Same input = same result

Test coverage targets:
- Happy path (normal usage)
- Edge cases (boundaries, empty, null)
- Error cases (invalid input, failures)
- Integration points (external dependencies)

Test types:
- Unit tests: Single function/component in isolation
- Integration tests: Multiple components together
- E2E tests: Full user workflows

Best practices:
- Mock external dependencies
- Use factories for test data
- Clean up after tests
- Avoid testing implementation details
- Test behavior, not structure`,

  userPromptTemplate: `Write tests for:

Target: {target}
Framework: {framework}

User request: {userInput}

Workspace files: {workspaceFiles}

Please:
1. Analyze what needs to be tested
2. Identify test cases (happy path, edge cases, errors)
3. Write the tests
4. Run the tests and show results
5. Note any issues or missing coverage`,
};
