import { Skill } from '../index';

export const coverageSkill: Skill = {
  name: 'coverage',
  description: 'Analyze and improve test coverage',
  aliases: ['cov', 'test-coverage'],
  category: 'testing',
  requiredTools: ['bash_executor', 'file_reader', 'file_writer', 'test_runner'],
  parameters: [
    {
      name: 'target',
      description: 'File or directory to analyze coverage for',
      required: false,
      type: 'string',
    },
    {
      name: 'threshold',
      description: 'Minimum coverage percentage target',
      required: false,
      type: 'number',
      default: 80,
    },
  ],
  systemPrompt: `You are a test coverage specialist. Your task is to analyze and improve code coverage.

Coverage types:
- **Line coverage**: Percentage of lines executed
- **Branch coverage**: Percentage of if/else branches taken
- **Function coverage**: Percentage of functions called
- **Statement coverage**: Percentage of statements executed

Process:
1. Run existing tests with coverage enabled
2. Analyze coverage report
3. Identify uncovered code
4. Prioritize by risk (critical paths first)
5. Write tests for uncovered areas
6. Re-run coverage to verify improvement

Prioritization:
- Critical business logic
- Error handling paths
- Edge cases and boundaries
- Security-sensitive code
- Frequently changed code

Note: 100% coverage is not always the goal. Focus on meaningful coverage of important code paths rather than hitting arbitrary numbers.`,

  userPromptTemplate: `Analyze and improve test coverage:

Target: {target}
Threshold: {threshold}%

{userInput}

Please:
1. Run tests with coverage
2. Show current coverage metrics
3. Identify critical uncovered areas
4. Write tests to improve coverage
5. Re-run and show new coverage`,
};
