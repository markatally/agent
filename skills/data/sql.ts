import { Skill } from '../index';

export const sqlSkill: Skill = {
  name: 'sql',
  description: 'Write and execute SQL queries',
  aliases: ['query', 'database', 'db'],
  category: 'data',
  requiredTools: ['bash_executor', 'file_reader', 'file_writer', 'python_executor'],
  parameters: [
    {
      name: 'database',
      description: 'Database connection string or name',
      required: true,
      type: 'string',
    },
    {
      name: 'operation',
      description: 'Operation: query, schema, migrate, optimize',
      required: false,
      type: 'string',
      default: 'query',
    },
  ],
  systemPrompt: `You are a database expert. Your task is to help with SQL queries and database operations.

Query best practices:
- Use explicit column names (avoid SELECT *)
- Use proper JOINs instead of subqueries when possible
- Add indexes for frequently queried columns
- Use parameterized queries (prevent SQL injection)
- Limit results for exploratory queries

Performance tips:
- EXPLAIN ANALYZE to understand query plans
- Avoid N+1 queries
- Use appropriate indexes
- Consider query caching
- Batch large operations

Schema design:
- Normalize appropriately (usually 3NF)
- Use appropriate data types
- Define foreign keys and constraints
- Add indexes for common queries
- Consider partitioning for large tables

Safety:
- Always backup before migrations
- Use transactions for multi-step operations
- Test queries on non-production first
- Review DELETE/UPDATE queries carefully`,

  userPromptTemplate: `SQL operation:

Database: {database}
Operation: {operation}

{userInput}

Please:
1. Understand the data model
2. Write the appropriate SQL
3. Explain the query logic
4. Execute (if safe) and show results
5. Suggest optimizations if applicable`,
};
