# Converting External Skills to Product Skills

## Overview

This document outlines the architecture and implementation strategy for converting **external skills** (metadata stored in JSON from synced GitHub repos) into **product skills** (executable TypeScript skills that users can invoke via slash commands or API).

## Current Architecture

### External Skills (Metadata Layer)
- **Source**: Synced from GitHub repos (Anthropic, OpenAI, AgentSkills, etc.)
- **Format**: JSON descriptors with metadata
- **Storage**: Database + file system (`apps/api/external-skills/`)
- **Structure**: `UnifiedSkill` interface from `types.ts`
- **Capability Levels**: EXTERNAL, INTERNAL, PRODUCT
- **Invocation Patterns**: `function`, `prompt`, `workflow`, `mcp`

### Product Skills (Execution Layer)
- **Source**: TypeScript modules in `/skills` directory
- **Format**: Compiled TypeScript with `Skill` interface
- **Invocation**: Slash commands (`/code`, `/debug`, etc.)
- **Registration**: Static Map in `skills/index.ts`
- **Execution**: Via `SkillProcessor` service

## The Gap

```
External Skills (JSON)              Product Skills (TypeScript)
─────────────────────               ───────────────────────────
📄 Metadata descriptors      →      🚀 Executable modules
🗄️  Database + file system    →      💻 Compiled code
📊 JSON schema                →      🔧 TypeScript interfaces
🔍 Query/filter only          →      ⚡ Invokable via /commands
```

## Conversion Strategy

### Architecture Components

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface Layer                      │
│  (Slash Commands, API Endpoints, Agent Invocation)          │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────┴─────────────────────────────────────┐
│              Unified Skill Orchestrator                      │
│  • Route to appropriate execution engine                     │
│  • Handle authentication & permissions                       │
│  • Track execution metrics                                   │
└───────┬───────────────────┬────────────────────┬────────────┘
        │                   │                    │
┌───────▼──────┐  ┌────────▼────────┐  ┌────────▼────────┐
│ Product      │  │ External Skill  │  │ Hybrid Skill    │
│ Skills       │  │ Executor        │  │ Registry        │
│ (TypeScript) │  │ (Dynamic JSON)  │  │ (Both)          │
└──────────────┘  └─────────────────┘  └─────────────────┘
```

### Implementation Phases

#### Phase 1: Bridge Layer
Create an adapter that transforms external skills into the product skill interface.

**File**: `apps/api/src/services/skills/external-bridge.ts`

```typescript
interface ExternalSkillAdapter {
  toProductSkill(external: UnifiedSkill): Skill;
  canExecute(external: UnifiedSkill): boolean;
  execute(external: UnifiedSkill, input: string, context: any): Promise<any>;
}
```

#### Phase 2: Dynamic Registration
Extend the skill registry to support dynamic skills from external sources.

**File**: `skills/registry.ts`

```typescript
class DynamicSkillRegistry {
  private staticSkills: Map<string, Skill>;
  private dynamicSkills: Map<string, Skill>;
  
  registerExternal(externalSkill: UnifiedSkill): void;
  unregister(skillId: string): void;
  list(includeExternal: boolean = true): Skill[];
}
```

#### Phase 3: Execution Engine
Build execution handlers for different invocation patterns.

```typescript
interface SkillExecutor {
  execute(skill: UnifiedSkill, context: ExecutionContext): Promise<ExecutionResult>;
}

class PromptSkillExecutor implements SkillExecutor {
  // Handle 'prompt' invocation pattern
}

class FunctionSkillExecutor implements SkillExecutor {
  // Handle 'function' invocation pattern
}

class WorkflowSkillExecutor implements SkillExecutor {
  // Handle 'workflow' invocation pattern
}

class MCPSkillExecutor implements SkillExecutor {
  // Handle 'mcp' invocation pattern
}
```

#### Phase 4: User Interface
Expose external skills through existing interfaces (slash commands, API).

```typescript
// Extend SkillProcessor to support external skills
class EnhancedSkillProcessor extends SkillProcessor {
  parseCommand(input: string): SkillInvocation | ExternalSkillInvocation | null;
  executeExternal(invocation: ExternalSkillInvocation): Promise<any>;
}
```

## Data Model Mapping

### UnifiedSkill → Skill Conversion

```typescript
function convertExternalToProduct(external: UnifiedSkill): Skill {
  return {
    name: external.canonicalId,
    description: external.description,
    aliases: extractAliases(external), // From metadata or category
    category: mapCategory(external.category),
    systemPrompt: external.systemPrompt || generateDefault(external),
    userPromptTemplate: external.userPromptTemplate || generateDefault(external),
    requiredTools: external.requiredTools || inferFromPattern(external),
    parameters: convertJsonSchemaToParams(external.inputSchema),
    // Additional metadata
    _external: {
      canonicalId: external.canonicalId,
      invocationPattern: external.invocationPattern,
      capabilityLevel: external.capabilityLevel,
      source: external.source
    }
  };
}
```

### Invocation Pattern Handlers

| Pattern    | Execution Strategy                                    |
|-----------|-------------------------------------------------------|
| `prompt`  | Format system + user prompt → Send to LLM            |
| `function`| Parse function definition → Execute via runtime      |
| `workflow`| Load workflow steps → Execute sequentially           |
| `mcp`     | Connect to MCP server → Invoke tool                  |

## Database Schema Extension

Add tables to track external skill usage and execution:

```sql
-- Track which external skills are enabled for users
CREATE TABLE user_external_skills (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  canonical_id VARCHAR REFERENCES external_skills(canonical_id),
  enabled BOOLEAN DEFAULT true,
  custom_config JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Track execution history
CREATE TABLE external_skill_executions (
  id UUID PRIMARY KEY,
  canonical_id VARCHAR REFERENCES external_skills(canonical_id),
  user_id UUID REFERENCES users(id),
  input JSONB,
  output JSONB,
  status VARCHAR, -- 'success', 'error', 'timeout'
  execution_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## API Endpoints

### List Available External Skills
```typescript
GET /api/skills/external
Query params:
  - category?: string
  - capabilityLevel?: 'EXTERNAL' | 'INTERNAL' | 'PRODUCT'
  - enabled?: boolean

Response: {
  skills: Array<{
    canonicalId: string;
    name: string;
    description: string;
    category: string;
    invocationPattern: string;
    enabled: boolean;
  }>
}
```

### Enable/Disable External Skill
```typescript
POST /api/skills/external/:canonicalId/toggle
Body: { enabled: boolean }

Response: { success: boolean }
```

### Execute External Skill
```typescript
POST /api/skills/external/:canonicalId/execute
Body: {
  input: string;
  parameters?: Record<string, any>;
  context?: {
    workspaceId?: string;
    files?: string[];
  }
}

Response: {
  executionId: string;
  result: any;
  executionTime: number;
}
```

## Security & Permissions

### Capability Levels
- **EXTERNAL**: Requires explicit user opt-in
- **INTERNAL**: Available to authenticated users
- **PRODUCT**: Generally available

### Execution Scope
- **SYSTEM**: Admin/system only
- **AGENT**: Agent can invoke autonomously
- **USER_VISIBLE**: Requires user confirmation

### Protection Rules
```typescript
class SkillPermissionChecker {
  canExecute(
    user: User, 
    skill: UnifiedSkill, 
    context: ExecutionContext
  ): Promise<boolean>;
  
  requiresConfirmation(skill: UnifiedSkill): boolean;
  
  validateInput(
    skill: UnifiedSkill, 
    input: any
  ): ValidationResult;
}
```

## Example: Converting "skill-creator" External Skill

### Original External Skill (JSON)
```json
{
  "canonicalId": "skill-creator",
  "name": "Skill Creator",
  "description": "Guide for creating effective skills",
  "version": "1.0.0",
  "category": "development",
  "invocationPattern": "prompt",
  "systemPrompt": "You are an expert at creating agent skills...",
  "userPromptTemplate": "Create a skill for: {userInput}...",
  "capabilityLevel": "EXTERNAL",
  "executionScope": "AGENT"
}
```

### Converted Product Skill (TypeScript)
```typescript
export const skillCreatorSkill: Skill = {
  name: 'skill-creator',
  description: 'Guide for creating effective skills',
  aliases: ['create-skill', 'new-skill'],
  category: 'development',
  requiredTools: ['file_writer', 'file_reader'],
  systemPrompt: "You are an expert at creating agent skills...",
  userPromptTemplate: "Create a skill for: {userInput}...",
  parameters: [
    {
      name: 'skillName',
      description: 'Name of the skill to create',
      required: true,
      type: 'string'
    }
  ]
};
```

### User Invocation
```bash
# Via slash command
/skill-creator Create a skill for data analysis

# Via API
POST /api/skills/external/skill-creator/execute
{
  "input": "Create a skill for data analysis"
}
```

## Implementation Checklist

- [ ] Phase 1: Bridge Layer
  - [ ] Create `ExternalSkillAdapter` interface
  - [ ] Implement `UnifiedSkill` → `Skill` converter
  - [ ] Add validation layer
  - [ ] Write unit tests

- [ ] Phase 2: Dynamic Registration
  - [ ] Create `DynamicSkillRegistry` class
  - [ ] Extend `SkillProcessor` to support external skills
  - [ ] Add skill enable/disable functionality
  - [ ] Implement skill discovery

- [ ] Phase 3: Execution Engine
  - [ ] Implement `PromptSkillExecutor`
  - [ ] Implement `FunctionSkillExecutor`
  - [ ] Implement `WorkflowSkillExecutor`
  - [ ] Implement `MCPSkillExecutor`
  - [ ] Add execution context management
  - [ ] Add error handling & retries

- [ ] Phase 4: API & UI
  - [ ] Create API endpoints for external skills
  - [ ] Add slash command support
  - [ ] Build skill management UI
  - [ ] Add execution history view

- [ ] Phase 5: Security & Permissions
  - [ ] Implement permission checking
  - [ ] Add user consent flow
  - [ ] Create audit logging
  - [ ] Add rate limiting

- [ ] Phase 6: Testing & Documentation
  - [ ] Write integration tests
  - [ ] Create user documentation
  - [ ] Build example skills
  - [ ] Performance testing

## Benefits

1. **Unified Interface**: Users access all skills (product + external) via same interface
2. **Dynamic Discovery**: New external skills automatically available after sync
3. **Community Skills**: Leverage skills from Anthropic, OpenAI, and community
4. **Extensibility**: Easy to add new invocation patterns
5. **Safety**: Protection and permission layers ensure secure execution
6. **Observability**: Track usage, performance, and errors

## Next Steps

1. **Start with Phase 1**: Build the bridge layer to understand conversion challenges
2. **Prototype with one skill**: Pick a simple external skill (e.g., prompt-based) and make it executable
3. **Iterate on execution patterns**: Test each invocation pattern type
4. **Build UI incrementally**: Start with API, then add slash commands, then visual UI
5. **Gather feedback**: Test with real users and iterate

## Related Files

- `apps/api/src/services/external-skills/types.ts` - External skill types
- `apps/api/src/services/external-skills/sync.ts` - Syncing logic
- `apps/api/src/services/skills/processor.ts` - Product skill processor
- `skills/index.ts` - Product skill registry
- `skills/development/code.ts` - Example product skill
