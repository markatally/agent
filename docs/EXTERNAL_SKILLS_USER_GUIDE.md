# External Skills User Guide

## Overview

External skills allow you to leverage agent skills from community repositories (Anthropic, OpenAI, AgentSkills, etc.) directly within Mark Agent. This guide shows you how to discover, enable, and use external skills.

## Quick Start

All external-skills API endpoints require authentication. Include a valid JWT in the `Authorization` header.

### Get an access token

```bash
# Login (replace with your email/password)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com", "password": "your-password"}'
```

Use the `accessToken` from the response in the `Authorization` header for subsequent requests:

```bash
export TOKEN="<accessToken from login response>"
```

### 1. List Available External Skills

```bash
# Using the API (with auth)
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/external-skills

# Filter by category
curl -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/external-skills?category=development"

# Search by keyword
curl -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/external-skills?q=react"
```

### 2. Enable an External Skill

```bash
# Enable a skill
curl -X POST http://localhost:3000/api/external-skills/skill-creator/toggle \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'
```

### 3. Execute the Skill

#### Option A: Via API

```bash
curl -X POST http://localhost:3000/api/external-skills/skill-creator/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Create a skill for data analysis",
    "parameters": {
      "language": "typescript"
    },
    "context": {
      "workspaceFiles": ["src/analysis.ts"],
      "additionalContext": {
        "framework": "pandas"
      }
    }
  }'
```

#### Option B: Via Slash Command (in chat)

```
/skill-creator Create a skill for data analysis language=typescript
```

## Understanding External Skills

### Skill Metadata

Each external skill has:

- **Canonical ID**: Unique identifier (e.g., `skill-creator`)
- **Name**: Human-readable name
- **Description**: What the skill does
- **Category**: Skill category (development, testing, etc.)
- **Invocation Pattern**: How it executes (`prompt`, `function`, `workflow`, `mcp`)
- **Capability Level**: `EXTERNAL` (requires enabling), `INTERNAL`, or `PRODUCT`
- **Execution Scope**: `AGENT` (autonomous), `USER_VISIBLE` (requires confirmation), or `SYSTEM` (admin only)

### Invocation Patterns

| Pattern    | Description                                      | Example Use Case          |
|-----------|--------------------------------------------------|---------------------------|
| `prompt`  | Provides specialized prompts and templates       | Skill creation, planning  |
| `function`| Executes code/functions                          | Data processing, analysis |
| `workflow`| Multi-step orchestrated workflows                | Complex automation        |
| `mcp`     | Connects to MCP (Model Context Protocol) servers | External tool integration |

## Use Cases

### Example 1: Using skill-creator

```bash
# 1. Enable the skill
curl -X POST http://localhost:3000/api/external-skills/skill-creator/toggle \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'

# 2. Use it via chat
/skill-creator Create a skill for REST API testing

# 3. The agent will:
#    - Use specialized prompts for skill creation
#    - Guide you through the process
#    - Generate a well-structured skill file
```

### Example 2: Using pdf (PDF processing)

```bash
# 1. Enable the skill
curl -X POST http://localhost:3000/api/external-skills/pdf/toggle \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'

# 2. Extract text from PDF
/pdf Extract text from invoice.pdf

# 3. The agent will:
#    - Load the PDF processing skill
#    - Extract text content
#    - Return structured data
```

### Example 3: Using xlsx (Excel processing)

```bash
# 1. Enable the skill
curl -X POST http://localhost:3000/api/external-skills/xlsx/toggle \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'

# 2. Process Excel file
/xlsx Parse data.xlsx and create a summary

# 3. The agent will:
#    - Read the Excel file
#    - Process the data
#    - Generate insights
```

## Finding Skills

### Browse All Skills

```bash
# Get all skills (product + external)
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/external-skills/all/list

# Filter by category
curl -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/external-skills/all/list?category=development"
```

### Search Skills

```bash
# Search for skills related to "testing"
curl -X POST http://localhost:3000/api/external-skills/search \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "testing"}'
```

### View Skill Statistics

```bash
curl http://localhost:3000/api/skills/stats/summary
```

Example response:

```json
{
  "totalSkills": 45,
  "productSkills": 23,
  "externalSkills": 22,
  "enabledExternal": 5,
  "categories": {
    "development": 12,
    "testing": 8,
    "devops": 7,
    "documentation": 6,
    "analysis": 5,
    "data": 4,
    "web": 3
  }
}
```

## Managing External Skills

### View Enabled Skills

```bash
# List only enabled external skills
curl http://localhost:3000/api/skills/external?enabled=true
```

### View Skill Details

```bash
# Get full details of a specific skill
curl http://localhost:3000/api/skills/external/skill-creator
```

### Disable a Skill

```bash
curl -X POST http://localhost:3000/api/skills/external/skill-creator/toggle \
  -d '{"enabled": false}'
```

## Slash Command Syntax

### Basic Usage

```
/[skill-name] [input]
```

Example:

```
/code Create a REST API endpoint for user authentication
```

### With Parameters

```
/[skill-name] [input] key=value key2=value2
```

Example:

```
/code Create a button component framework=react language=typescript
```

### Available Parameters

Parameters vary by skill. Common ones include:

- `language`: Programming language (e.g., `typescript`, `python`)
- `framework`: Framework to use (e.g., `react`, `fastapi`)
- `style`: Code style or approach
- `format`: Output format

## Best Practices

### 1. Enable Only What You Need

External skills consume resources. Enable only the skills you actively use.

### 2. Check Skill Metadata

Before enabling, check:
- **Execution Scope**: Does it need confirmation?
- **Required Tools**: Does your environment support it?
- **Source**: Is it from a trusted repository?

### 3. Use Descriptive Inputs

External skills work best with clear, specific inputs:

❌ Bad: `/code button`

✅ Good: `/code Create a reusable button component with hover effects and loading state`

### 4. Provide Context

Use the context parameter to give the skill relevant information:

```json
{
  "input": "Optimize this function",
  "context": {
    "workspaceFiles": ["src/utils/performance.ts"],
    "additionalContext": {
      "currentPerformance": "200ms",
      "targetPerformance": "50ms"
    }
  }
}
```

## Integration with Product Skills

External skills work seamlessly with built-in product skills:

```
# Built-in product skills (always available)
/code, /debug, /test, /deploy, /docs, etc.

# External skills (enable as needed)
/skill-creator, /pdf, /xlsx, /mcp-builder, etc.
```

You can use them together:

1. `/skill-creator` to create a new skill
2. `/code` to implement it
3. `/test` to add tests
4. `/docs` to document it

## Troubleshooting

### Skill Not Found

**Issue**: Slash command returns "skill not found"

**Solution**:
1. Check if the skill is enabled: `curl http://localhost:3000/api/skills/external?enabled=true`
2. Enable it: `curl -X POST http://localhost:3000/api/skills/external/[skill-id]/toggle -d '{"enabled": true}'`

### Execution Failed

**Issue**: Skill execution returns an error

**Solution**:
1. Check skill status: `curl http://localhost:3000/api/skills/external/[skill-id]`
2. Verify required tools are available
3. Check execution logs for details
4. Try with simpler input to isolate the issue

### Slow Performance

**Issue**: Skill execution is slow

**Solution**:
1. Reduce context size (fewer workspace files)
2. Use more specific inputs
3. Check if skill has many dependencies
4. Consider using a product skill instead for better performance

## API Reference

### Endpoints

| Endpoint                                    | Method | Description                    |
|---------------------------------------------|--------|--------------------------------|
| `/api/skills/external`                      | GET    | List external skills           |
| `/api/skills/external/:id`                  | GET    | Get skill details              |
| `/api/skills/external/:id/toggle`           | POST   | Enable/disable skill           |
| `/api/skills/external/:id/execute`          | POST   | Execute skill                  |
| `/api/skills/all/list`                      | GET    | List all skills                |
| `/api/skills/stats/summary`                 | GET    | Get skill statistics           |
| `/api/skills/search`                        | POST   | Search skills                  |

### Response Formats

#### List Skills Response

```json
{
  "skills": [
    {
      "canonicalId": "skill-creator",
      "name": "Skill Creator",
      "description": "Guide for creating effective skills",
      "category": "development",
      "version": "1.0.0",
      "invocationPattern": "prompt",
      "capabilityLevel": "EXTERNAL",
      "executionScope": "AGENT",
      "isProtected": false,
      "source": {
        "repoUrl": "https://github.com/anthropics/skills",
        "repoPath": "skills/skill-creator/SKILL.md"
      },
      "enabled": true
    }
  ],
  "total": 1
}
```

#### Execute Skill Response

```json
{
  "success": true,
  "result": {
    "systemPrompt": "You are executing the 'Skill Creator' skill...",
    "userPrompt": "Create a skill for: data analysis...",
    "response": "..."
  },
  "executionTime": 150,
  "metadata": {
    "invocationPattern": "prompt",
    "skillId": "skill-creator",
    "toolsUsed": ["file_writer", "file_reader"]
  }
}
```

## Next Steps

1. **Explore**: Browse available external skills
2. **Enable**: Choose skills that match your workflow
3. **Use**: Invoke them via slash commands or API
4. **Integrate**: Combine with product skills for powerful workflows
5. **Contribute**: Share your experiences and help improve skills

## Support

- **Documentation**: `/docs/EXTERNAL_SKILLS_TO_PRODUCT.md`
- **Examples**: `/examples/external-skills-demo.ts`
- **Issues**: Report bugs and feature requests via GitHub

## Advanced Topics

### Creating Custom Adapters

See `apps/api/src/services/skills/external-bridge.ts` for how to customize skill conversion logic.

### Extending Executors

Add support for new invocation patterns in `apps/api/src/services/skills/external-executor.ts`.

### Building Your Own Skills

Use the `/skill-creator` external skill to generate properly formatted skills that can be shared with the community!
