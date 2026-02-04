# External Skills Architecture

## System Overview

This document describes the architecture for converting external skills (synced from GitHub repos) into executable product skills that users can invoke via slash commands or API.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USER INTERFACES                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Chat / Slash │  │  REST API    │  │   Web UI (Future)        │  │
│  │  Commands    │  │  Endpoints   │  │   Skill Browser          │  │
│  │  /skill-name │  │  POST/GET    │  │   Enable/Disable UI      │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────────┘  │
└─────────┼──────────────────┼─────────────────────┼──────────────────┘
          │                  │                     │
          └──────────────────┼─────────────────────┘
                             │
┌────────────────────────────▼──────────────────────────────────────────┐
│                   ENHANCED SKILL PROCESSOR                             │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  • Parse slash commands                                         │  │
│  │  • Resolve skills (product or external)                        │  │
│  │  • Route to appropriate handler                                │  │
│  │  • Format prompts and context                                  │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└───────────┬────────────────────────┬───────────────────────────────────┘
            │                        │
            │                        │
   ┌────────▼────────┐      ┌────────▼────────────┐
   │  PRODUCT        │      │  DYNAMIC            │
   │  SKILLS         │      │  SKILL REGISTRY     │
   │  (TypeScript)   │      │  (External Skills)  │
   │                 │      │                     │
   │  • /code        │      │  • Bridge Layer     │
   │  • /test        │      │  • Adapter          │
   │  • /debug       │      │  • Cache Management │
   │  • /deploy      │      │  • Enable/Disable   │
   │  • etc.         │      │                     │
   └─────────────────┘      └──────────┬──────────┘
                                       │
                    ┌──────────────────┴─────────────────┐
                    │                                     │
           ┌────────▼────────┐               ┌───────────▼────────┐
           │ EXTERNAL SKILL  │               │ EXTERNAL SKILL     │
           │ ADAPTER         │               │ ORCHESTRATOR       │
           │                 │               │                    │
           │ • Convert       │               │ • Route by pattern │
           │   UnifiedSkill  │               │ • Execute skills   │
           │   → Skill       │               │ • Handle errors    │
           │ • Map metadata  │               │ • Track metrics    │
           │ • Validate      │               │                    │
           └────────┬────────┘               └─────────┬──────────┘
                    │                                  │
                    │                        ┌─────────┴─────────┐
                    │                        │                   │
                    │              ┌─────────▼────────┐  ┌──────▼────────┐
                    │              │ Prompt Executor  │  │Function Exec. │
                    │              │ (LLM prompts)    │  │(Code sandbox) │
                    │              └──────────────────┘  └───────────────┘
                    │              ┌──────────────────┐  ┌───────────────┐
                    │              │Workflow Executor │  │ MCP Executor  │
                    │              │(Multi-step flow) │  │(MCP servers)  │
                    │              └──────────────────┘  └───────────────┘
                    │
         ┌──────────▼──────────┐
         │ EXTERNAL SKILL      │
         │ LOADER              │
         │                     │
         │ • Load from DB      │
         │ • Read JSON files   │
         │ • Create snapshots  │
         │ • Filter/query      │
         └──────────┬──────────┘
                    │
    ┌───────────────┴──────────────┐
    │                               │
┌───▼────────────┐      ┌──────────▼─────────┐
│  DATABASE      │      │  FILE SYSTEM       │
│                │      │                     │
│  • external_   │      │  external-skills/  │
│    skills      │      │    ├─ canonical/   │
│  • user_       │      │    ├─ sources/     │
│    external_   │      │    └─ mappings/    │
│    skills      │      │                     │
│  • external_   │      │                     │
│    skill_      │      │                     │
│    executions  │      │                     │
└────────────────┘      └────────────────────┘
         │                       │
         └───────────┬───────────┘
                     │
           ┌─────────▼──────────┐
           │  SYNC SERVICE      │
           │                     │
           │  • Clone repos      │
           │  • Normalize skills │
           │  • Deduplicate      │
           │  • Store to DB/FS   │
           └─────────┬──────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
    ┌────▼─────┐    ┌──────────▼─────┐
    │ GitHub   │    │  GitHub Repos   │
    │ anthropic│    │  • openai       │
    │ /skills  │    │  • agentskills  │
    └──────────┘    └─────────────────┘
```

## Data Flow

### 1. Sync Flow (Background Process)

```
GitHub Repos → Sync Service → Normalize → Deduplicate → Database + File System
```

1. **Clone**: Fetch latest from configured repos
2. **Discover**: Find all skill files (.md, .json, .ts)
3. **Normalize**: Convert to UnifiedSkill format
4. **Deduplicate**: Merge similar skills
5. **Protect**: Check for conflicts with product skills
6. **Store**: Save to database and file system

### 2. Enable Flow (User Action)

```
User Request → API Endpoint → Dynamic Registry → External Skill Loader → Cache
```

1. **Request**: User enables a skill via API
2. **Load**: Fetch skill from database
3. **Validate**: Check if skill can execute
4. **Convert**: Transform to product skill format
5. **Cache**: Store in registry cache
6. **Persist**: Save user preference to database

### 3. Execution Flow (Runtime)

```
User Input → Enhanced Processor → Orchestrator → Executor → Result
```

#### For Product Skills:
```
/code Create component → SkillProcessor → Format Prompts → LLM
```

#### For External Skills (Prompt Pattern):
```
/skill-creator Create skill → EnhancedProcessor
  → DynamicRegistry (lookup)
  → ExternalSkillOrchestrator
  → PromptSkillExecutor
  → Format prompts with templates
  → LLM
  → Result
```

#### For External Skills (Function Pattern):
```
/data-processor Parse CSV → EnhancedProcessor
  → DynamicRegistry (lookup)
  → ExternalSkillOrchestrator
  → FunctionSkillExecutor
  → Sandbox execution
  → Result
```

## Component Responsibilities

### Enhanced Skill Processor
- **Location**: `apps/api/src/services/skills/enhanced-processor.ts`
- **Responsibilities**:
  - Parse slash commands
  - Resolve skill names/aliases
  - Route to product or external skills
  - Manage execution context
  - Return formatted results

### Dynamic Skill Registry
- **Location**: `apps/api/src/services/skills/dynamic-registry.ts`
- **Responsibilities**:
  - Maintain cache of enabled external skills
  - Provide unified lookup across product + external
  - Handle enable/disable operations
  - Support search and filtering
  - Track statistics

### External Skill Adapter
- **Location**: `apps/api/src/services/skills/external-bridge.ts`
- **Responsibilities**:
  - Convert UnifiedSkill → Skill interface
  - Map categories and metadata
  - Generate default prompts
  - Infer required tools
  - Validate executability

### External Skill Orchestrator
- **Location**: `apps/api/src/services/skills/external-executor.ts`
- **Responsibilities**:
  - Route skills to appropriate executor
  - Handle execution context
  - Track execution metrics
  - Manage errors and timeouts
  - Return standardized results

### Pattern Executors
- **Prompt Executor**: Format prompts and call LLM
- **Function Executor**: Sandbox and execute code
- **Workflow Executor**: Orchestrate multi-step flows
- **MCP Executor**: Connect to MCP servers

### External Skill Loader
- **Location**: `apps/api/src/services/external-skills/loader.ts`
- **Responsibilities**:
  - Load skills from database
  - Read skill JSON files
  - Create and manage snapshots
  - Filter and query skills
  - Session-based caching

### Sync Service
- **Location**: `apps/api/src/services/external-skills/sync.ts`
- **Responsibilities**:
  - Clone Git repositories
  - Find and parse skill files
  - Normalize to UnifiedSkill format
  - Deduplicate similar skills
  - Protect from conflicts
  - Store to database and file system

## Database Schema

### external_skills
Stores metadata about all synced external skills.

```sql
CREATE TABLE external_skills (
  canonical_id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  description TEXT,
  version VARCHAR,
  category VARCHAR,
  invocation_pattern VARCHAR,
  capability_level VARCHAR,
  execution_scope VARCHAR,
  is_protected BOOLEAN,
  file_path VARCHAR,
  -- ... other fields
)
```

### user_external_skills
Tracks which users have enabled which skills.

```sql
CREATE TABLE user_external_skills (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  canonical_id VARCHAR REFERENCES external_skills,
  enabled BOOLEAN DEFAULT true,
  custom_config JSONB,
  enabled_at TIMESTAMP,
  disabled_at TIMESTAMP
)
```

### external_skill_executions
Logs all skill executions for analytics.

```sql
CREATE TABLE external_skill_executions (
  id UUID PRIMARY KEY,
  canonical_id VARCHAR REFERENCES external_skills,
  user_id UUID,
  input JSONB,
  output JSONB,
  status VARCHAR, -- 'success', 'error', etc.
  execution_time_ms INTEGER,
  created_at TIMESTAMP
)
```

## API Endpoints

| Endpoint                               | Method | Purpose                    |
|---------------------------------------|--------|----------------------------|
| `/api/skills/external`                | GET    | List available skills      |
| `/api/skills/external/:id`            | GET    | Get skill details          |
| `/api/skills/external/:id/toggle`     | POST   | Enable/disable skill       |
| `/api/skills/external/:id/execute`    | POST   | Execute a skill            |
| `/api/skills/all/list`                | GET    | List all skills (unified)  |
| `/api/skills/stats/summary`           | GET    | Get usage statistics       |
| `/api/skills/search`                  | POST   | Search skills              |

## Security Considerations

### Capability Levels
- **EXTERNAL**: User must explicitly enable (untrusted)
- **INTERNAL**: Available to authenticated users
- **PRODUCT**: Generally available (vetted)

### Execution Scope
- **SYSTEM**: Admin/system only (dangerous operations)
- **AGENT**: Agent can invoke autonomously
- **USER_VISIBLE**: Requires user confirmation

### Sandboxing
- Function executors run in isolated environments
- Resource limits (CPU, memory, time)
- Network access controls
- File system restrictions

### Rate Limiting
- Per-user execution limits
- Per-skill execution limits
- Global rate limits

## Performance Optimization

### Caching Strategy
- **Registry Cache**: 5-minute TTL for enabled skills
- **Snapshot Cache**: Session-based skill snapshots
- **Database Queries**: Indexed by user_id, canonical_id, status

### Lazy Loading
- Load external skills only when enabled
- Parse JSON files on-demand
- Cache parsed results

### Parallel Execution
- Multiple skills can execute concurrently
- Independent execution contexts
- Async/await throughout

## Monitoring & Analytics

### Metrics Tracked
- Execution count per skill
- Success/failure rates
- Average execution time
- Most popular skills
- User adoption rates

### Logging
- All executions logged to database
- Error details captured
- Performance metrics recorded

### Views
- `external_skill_usage_stats`: Aggregated statistics
- `user_skills_with_details`: User preferences with metadata

## Future Enhancements

### Phase 2 (Next)
- [ ] Web UI for browsing and enabling skills
- [ ] Skill recommendations based on usage
- [ ] Skill dependencies and chaining
- [ ] Custom skill creation wizard

### Phase 3 (Future)
- [ ] Skill marketplace
- [ ] Community ratings and reviews
- [ ] Skill versioning and updates
- [ ] A/B testing of skill prompts
- [ ] Skill performance analytics dashboard

## Related Documentation

- [External Skills to Product Skills](./EXTERNAL_SKILLS_TO_PRODUCT.md) - Implementation guide
- [External Skills User Guide](./EXTERNAL_SKILLS_USER_GUIDE.md) - User documentation
- [Example Demo](../examples/external-skills-demo.ts) - Code examples
- [API Routes](../apps/api/src/routes/external-skills.ts) - API implementation
