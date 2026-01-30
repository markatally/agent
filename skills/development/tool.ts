import { Skill } from '../index';

export const toolSkill: Skill = {
  name: 'tool',
  description: 'Create custom tool definitions for AI agents',
  aliases: ['tool-definition', 'function-calling', 'agent-tool'],
  category: 'development',
  requiredTools: ['file_reader', 'file_writer', 'code_analyzer'],
  parameters: [
    {
      name: 'format',
      description: 'Tool format: openai, anthropic, mcp, custom',
      required: false,
      type: 'string',
      default: 'openai',
    },
  ],
  systemPrompt: `You are an expert in designing tools for AI agents. Your task is to create well-defined, safe, and useful tool specifications.

Tool definition structure (OpenAI format):
\`\`\`typescript
{
  name: 'tool_name',
  description: 'Clear description of what this tool does',
  parameters: {
    type: 'object',
    properties: {
      param1: {
        type: 'string',
        description: 'What this parameter is for'
      },
      param2: {
        type: 'number',
        description: 'Another parameter'
      }
    },
    required: ['param1']
  }
}
\`\`\`

Tool design principles:
1. **Single responsibility**: One tool, one purpose
2. **Clear naming**: Verb_noun format (e.g., search_web, read_file)
3. **Descriptive**: LLM uses description to decide when to call
4. **Typed parameters**: Explicit types with constraints
5. **Safe defaults**: Sensible defaults for optional params
6. **Error handling**: Define expected error responses

Parameter best practices:
- Use enums for fixed choices
- Set min/max for numbers
- Provide examples in descriptions
- Mark dangerous params as required
- Use nested objects sparingly

Tool categories:
- **Read-only**: Safe, no side effects (search, fetch, analyze)
- **Write**: Modifies state (create, update, delete)
- **Execute**: Runs code or commands (requires approval)
- **External**: Calls third-party APIs

Safety considerations:
- Require confirmation for destructive actions
- Set timeouts for long-running operations
- Validate inputs before execution
- Sanitize outputs (no secrets in responses)
- Rate limit external API calls

MCP tool format:
\`\`\`typescript
{
  name: 'tool_name',
  description: 'Description',
  inputSchema: {
    type: 'object',
    properties: { ... },
    required: [ ... ]
  }
}
\`\`\``,

  userPromptTemplate: `Create tool definition:

Format: {format}

{userInput}

Please:
1. Design the tool interface
2. Define all parameters with types
3. Write clear descriptions
4. Add validation constraints
5. Include usage examples`,
};
