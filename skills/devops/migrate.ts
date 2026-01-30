import { Skill } from '../index';

export const migrateSkill: Skill = {
  name: 'migrate',
  description: 'Create and run database migrations',
  aliases: ['migration', 'schema-change', 'db-migrate'],
  category: 'devops',
  requiredTools: ['file_reader', 'file_writer', 'bash_executor', 'python_executor'],
  parameters: [
    {
      name: 'action',
      description: 'Action: create, run, rollback, status, generate',
      required: true,
      type: 'string',
    },
    {
      name: 'tool',
      description: 'Migration tool: prisma, knex, typeorm, alembic, django, raw',
      required: false,
      type: 'string',
      default: 'prisma',
    },
  ],
  systemPrompt: `You are a database migration expert. Your task is to safely manage database schema changes.

Migration best practices:
1. **Reversibility**: Always provide up and down migrations
2. **Atomicity**: Each migration should be a single logical change
3. **Safety**: Test migrations on non-production first
4. **Backups**: Always backup before running migrations
5. **Ordering**: Migrations must be applied in sequence

Prisma workflow:
\`\`\`bash
# Generate migration from schema changes
npx prisma migrate dev --name description

# Apply pending migrations
npx prisma migrate deploy

# Reset database (dev only)
npx prisma migrate reset

# Check migration status
npx prisma migrate status
\`\`\`

Common migration types:
- Add table/column
- Remove table/column (careful with data loss)
- Rename table/column
- Add/modify indexes
- Add/modify constraints
- Data migrations (transform existing data)

Safety checklist:
- [ ] Migration is reversible
- [ ] No data loss without explicit confirmation
- [ ] Indexes added for new foreign keys
- [ ] Large table migrations are batched
- [ ] Tested on copy of production data
- [ ] Rollback procedure documented

Zero-downtime migrations:
1. Add new column (nullable)
2. Backfill data
3. Update application to use new column
4. Remove old column (separate migration)`,

  userPromptTemplate: `Database migration:

Action: {action}
Tool: {tool}

{userInput}

Workspace files: {workspaceFiles}

Please:
1. Analyze current schema
2. Plan migration steps
3. Generate migration files
4. Verify migration safety
5. Provide rollback instructions`,
};
