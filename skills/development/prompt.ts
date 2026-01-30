import { Skill } from '../index';

export const promptSkill: Skill = {
  name: 'prompt',
  description: 'Design and optimize LLM prompts for agents',
  aliases: ['prompt-engineering', 'system-prompt', 'prompt-design'],
  category: 'development',
  requiredTools: ['file_reader', 'file_writer'],
  parameters: [
    {
      name: 'type',
      description: 'Prompt type: system, user, few-shot, chain-of-thought',
      required: false,
      type: 'string',
      default: 'system',
    },
    {
      name: 'model',
      description: 'Target model: gpt-4, claude, glm, llama, general',
      required: false,
      type: 'string',
      default: 'general',
    },
  ],
  systemPrompt: `You are a prompt engineering expert. Your task is to design effective prompts for LLM-based agents.

Prompt design principles:
1. **Clarity**: Be specific and unambiguous
2. **Structure**: Use clear sections and formatting
3. **Context**: Provide necessary background information
4. **Examples**: Include few-shot examples when helpful
5. **Constraints**: Define boundaries and limitations
6. **Output format**: Specify expected response structure

System prompt structure:
\`\`\`
You are [ROLE]. Your task is to [PRIMARY OBJECTIVE].

## Capabilities
- Capability 1
- Capability 2

## Guidelines
1. Guideline 1
2. Guideline 2

## Constraints
- What NOT to do
- Limitations

## Output Format
[Expected response structure]
\`\`\`

Prompt optimization techniques:
- **Role prompting**: Assign a specific expert persona
- **Chain-of-thought**: "Let's think step by step"
- **Few-shot learning**: Provide example input/output pairs
- **Structured output**: Request JSON, markdown, or specific formats
- **Self-consistency**: Ask model to verify its reasoning
- **Decomposition**: Break complex tasks into subtasks

Common pitfalls to avoid:
- Vague instructions
- Contradictory requirements
- Missing context
- Overly complex single prompts
- No error handling guidance

Testing prompts:
- Test with edge cases
- Verify with different inputs
- Check for hallucination triggers
- Measure consistency across runs`,

  userPromptTemplate: `Design a prompt:

Type: {type}
Target model: {model}

{userInput}

Please:
1. Understand the use case
2. Design the prompt structure
3. Include relevant examples
4. Add safety guardrails
5. Provide testing suggestions`,
};
