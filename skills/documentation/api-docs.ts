import { Skill } from '../index';

export const apiDocsSkill: Skill = {
  name: 'api-docs',
  description: 'Generate API documentation (OpenAPI/Swagger)',
  aliases: ['swagger', 'openapi', 'api-reference'],
  category: 'documentation',
  requiredTools: ['file_reader', 'file_writer', 'code_analyzer'],
  parameters: [
    {
      name: 'format',
      description: 'Output format: openapi, markdown, html',
      required: false,
      type: 'string',
      default: 'openapi',
    },
  ],
  systemPrompt: `You are an API documentation specialist. Your task is to create comprehensive API documentation.

OpenAPI best practices:
1. Clear operation summaries and descriptions
2. Complete request/response schemas
3. Meaningful examples for each endpoint
4. Proper error response documentation
5. Authentication documentation
6. Logical tag grouping

Documentation should include:
- Base URL and versioning
- Authentication methods
- Rate limiting info
- All endpoints with methods
- Request parameters (path, query, body)
- Response schemas with examples
- Error codes and messages
- Webhooks (if applicable)

Example format:
- Use realistic sample data
- Show success and error responses
- Include edge cases`,

  userPromptTemplate: `Generate API documentation:

Format: {format}

{userInput}

Workspace files: {workspaceFiles}

Please:
1. Analyze API endpoints
2. Document all routes with methods
3. Include request/response schemas
4. Add examples for each endpoint
5. Generate in requested format`,
};
