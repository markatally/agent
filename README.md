# Mark Agent

AI-powered autonomous agent that executes complex tasks through natural language interaction, tool usage, and code execution.

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) 1.0+ (or Node.js 20+)
- [Docker](https://www.docker.com/) and Docker Compose
- PostgreSQL 16+ (or use Docker)
- Redis 7+ (or use Docker)

### 1. Install Dependencies

```bash
bun install
```

### 2. Set Up Environment

```bash
cp .env.example .env
# Edit .env with your LLM_API_KEY and other settings
```

### 3. Start Infrastructure

```bash
# Start database and Redis
docker-compose up -d db redis
```

### 4. Run Database Migrations

```bash
cd apps/api
bunx prisma migrate dev
cd ../..
```

### 5. Start Development Servers

```bash
# Start both frontend and backend
bun run dev

# Or start separately:
bun run dev:api  # Backend on http://localhost:4000
bun run dev:web  # Frontend on http://localhost:3000
```

## Project Structure

```
mark-agent/
├── apps/
│   ├── web/           # React frontend
│   └── api/           # Hono backend
├── packages/
│   └── shared/        # Shared types
├── skills/            # Agent skills (31 total)
├── config/            # Configuration files
└── docker/            # Docker files
```

## Key Files

Top code files and their core functions (~20% of code, ~80% of main behavior):

| File | Core Function |
|------|---------------|
| `apps/api/src/routes/stream.ts` | Main agent SSE endpoint: LLM loop, tool execution, reasoning/thinking events, sandbox/browser events, PPT pipeline, session scoping |
| `apps/api/src/services/tasks/task_manager.ts` | Task orchestration: goal inference from user message, execution plans, step limits, search/PPT flow control, reflection |
| `apps/web/src/stores/chatStore.ts` | Central chat state: messages, tool calls, agent steps, reasoning traces, browser timeline, artifacts; session-scoped keys |
| `apps/api/src/services/tools/registry.ts` | Tool registry: built-ins (file, bash, PPT, web search, video, browser) and MCP bridge registration |
| `apps/api/src/services/llm.ts` | LLM client for OpenAI-compatible APIs: chat completions, streaming, tool-calling format |
| `apps/web/src/hooks/useSSE.ts` | SSE connection hook: connects to stream, maps events into chatStore, idle timeout, session filtering |
| `apps/web/src/hooks/useChat.ts` | Chat hydration: load/reconstruct messages, map agent steps from metadata, persistence |
| `apps/web/src/lib/sse.ts` | SSE client: EventSource wrapper, reconnection, event parsing, close handling |
| `apps/web/src/components/chat/ChatContainer.tsx` | Main chat UI: send messages, render timeline, wire SSE, layout/inspector coordination |
| `apps/api/src/services/browser/manager.ts` | Browser sessions: Playwright Chromium per session, screencast, viewport, lifecycle |
| `apps/api/src/services/mcp/bridge.ts` | MCP integration: bridge MCP tools to native Tool interface for registry |
| `apps/api/src/services/sandbox/manager.ts` | Sandbox: Docker containers for bash/code execution, filesystem mounts, exec isolation |
| `apps/api/src/routes/messages.ts` | Message CRUD: create messages, load history, session ownership checks |
| `apps/api/src/services/skills/processor.ts` | Skill processor: slash-command parsing, parameter extraction, prompt formatting |
| `packages/shared/src/index.ts` | Shared types: Message, ToolCall, ToolResult, Artifact, ExecutionPlan, TableIR |
| `apps/api/src/index.ts` | API bootstrap: Hono app, CORS, auth/session/stream/file/skill routes |
| `apps/web/src/components/inspector/InspectorPanel.tsx` | Inspector tabs: Computer, Tools, Sources, Reasoning |
| `apps/web/src/components/inspector/ComputerPanel.tsx` | Computer mode: browser timeline, snapshots, scrubber; session-scoped rendering |
| `apps/web/src/components/inspector/ReasoningTrace.tsx` | Reasoning trace UI: tool steps, thinking content, collapsed/expanded |
| `apps/api/src/services/tools/video_transcript.ts` | Video transcript tool: Bilibili/YouTube transcript fetching |

## Available Scripts

```bash
bun run dev          # Start all services
bun run dev:web      # Start frontend only
bun run dev:api      # Start backend only
bun run build        # Build for production
bun run test         # Run tests
bun run lint         # Run linting
bun run worker       # Start background worker
bun run db:migrate   # Run database migrations
bun run db:studio    # Open Prisma Studio
```

## Skills

31 predefined skills across 10 categories:

- **Development**: /code, /refactor, /review, /api, /prompt, /tool, /auth, /component
- **DevOps**: /deploy, /docker, /git, /migrate, /ci, /env, /monitor
- **Documentation**: /docs, /api-docs, /changelog
- **Testing**: /test, /coverage
- **Debugging**: /debug, /fix
- **Analysis**: /analyze, /security
- **Web**: /scrape, /search
- **Data**: /data, /sql
- **Integration**: /mcp
- **Planning**: /plan, /architect

## API Endpoints

- `GET /api/health` - Health check
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login
- `POST /api/sessions` - Create session
- `POST /api/sessions/:id/messages` - Send message
- `GET /api/sessions/:id/stream` - SSE stream

See `spec.md` for complete API documentation.

## Configuration

Edit `config/default.json` to customize:

- LLM settings (model, temperature, tokens)
- Rate limits
- Sandbox settings
- Tool permissions
- Security settings

**Browser mode (Computer tab / PPT screenshots):** To use webpage screenshots during PPT or browsing, install Playwright browsers: run `scripts/start.sh --INSTALL_BROWSER` or from `apps/api` run `npx playwright install chromium`.

## Docker Deployment

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## License

MIT
