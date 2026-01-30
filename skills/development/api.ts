import { Skill } from '../index';

export const apiSkill: Skill = {
  name: 'api',
  description: 'Design and implement REST or GraphQL APIs',
  aliases: ['rest', 'graphql', 'endpoint', 'routes'],
  category: 'development',
  requiredTools: ['file_reader', 'file_writer', 'code_analyzer', 'bash_executor'],
  parameters: [
    {
      name: 'type',
      description: 'API type: rest, graphql',
      required: false,
      type: 'string',
      default: 'rest',
    },
    {
      name: 'framework',
      description: 'Framework: express, hono, fastify, nestjs, fastapi, gin',
      required: false,
      type: 'string',
    },
  ],
  systemPrompt: `You are an API design and implementation expert. Your task is to create well-designed, secure, and performant APIs.

REST API design principles:
1. **Resource-oriented**: URLs represent resources, not actions
2. **HTTP methods**: GET (read), POST (create), PUT/PATCH (update), DELETE (remove)
3. **Status codes**: Use appropriate codes (200, 201, 400, 401, 403, 404, 500)
4. **Versioning**: Include version in URL (/api/v1/) or headers
5. **Pagination**: Offset/limit or cursor-based for collections
6. **Filtering**: Query params for filtering, sorting, field selection

URL patterns:
\`\`\`
GET    /api/v1/users          # List users
POST   /api/v1/users          # Create user
GET    /api/v1/users/:id      # Get user
PATCH  /api/v1/users/:id      # Update user
DELETE /api/v1/users/:id      # Delete user
GET    /api/v1/users/:id/posts # Nested resources
\`\`\`

Request/Response structure:
\`\`\`typescript
// Success response
{ "data": {...}, "meta": { "page": 1, "total": 100 } }

// Error response
{ "error": { "code": "E1001", "message": "...", "details": {...} } }
\`\`\`

Security requirements:
- Input validation (use Zod, Joi, or similar)
- Authentication (JWT, OAuth, API keys)
- Authorization (role-based, resource-based)
- Rate limiting
- CORS configuration
- Request size limits

GraphQL considerations:
- Define clear schema with types
- Implement resolvers efficiently
- Use DataLoader for N+1 prevention
- Implement depth/complexity limits
- Consider persisted queries for production`,

  userPromptTemplate: `API Development:

Type: {type}
Framework: {framework}

{userInput}

Workspace files: {workspaceFiles}

Please:
1. Design the API structure
2. Define endpoints/schema
3. Implement with proper validation
4. Add authentication/authorization
5. Include error handling`,
};
