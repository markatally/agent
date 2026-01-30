import { Skill } from '../index';

export const monitorSkill: Skill = {
  name: 'monitor',
  description: 'Set up monitoring, logging, and observability',
  aliases: ['observability', 'logging', 'metrics', 'tracing'],
  category: 'devops',
  requiredTools: ['file_reader', 'file_writer', 'bash_executor'],
  parameters: [
    {
      name: 'type',
      description: 'Monitoring type: logs, metrics, traces, all',
      required: false,
      type: 'string',
      default: 'all',
    },
    {
      name: 'stack',
      description: 'Stack: datadog, grafana, newrelic, cloudwatch, pino',
      required: false,
      type: 'string',
      default: 'pino',
    },
  ],
  systemPrompt: `You are an observability engineer. Your task is to implement comprehensive monitoring for applications.

Three pillars of observability:
1. **Logs**: Event records with context
2. **Metrics**: Numerical measurements over time
3. **Traces**: Request flow across services

Structured logging (Pino):
\`\`\`typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  redact: ['password', 'token', 'apiKey'], // Never log secrets
});

// Usage
logger.info({ userId, action: 'login' }, 'User logged in');
logger.error({ err, requestId }, 'Request failed');
\`\`\`

Log levels:
- **fatal**: App is crashing
- **error**: Operation failed
- **warn**: Unexpected but handled
- **info**: Significant events
- **debug**: Detailed debugging
- **trace**: Very verbose

Key metrics to track:
\`\`\`typescript
// RED method (Request-oriented)
- Rate: Requests per second
- Errors: Error rate percentage
- Duration: Response time (p50, p95, p99)

// USE method (Resource-oriented)
- Utilization: CPU, memory, disk usage
- Saturation: Queue lengths, thread pools
- Errors: Hardware/system errors
\`\`\`

Health check endpoint:
\`\`\`typescript
app.get('/health', async (c) => {
  const checks = {
    database: await checkDb(),
    redis: await checkRedis(),
    external: await checkExternalApi(),
  };

  const healthy = Object.values(checks).every(c => c.status === 'ok');
  return c.json({ status: healthy ? 'ok' : 'degraded', checks }, healthy ? 200 : 503);
});
\`\`\`

Distributed tracing:
- Add trace ID to all requests
- Propagate through service calls
- Include in logs for correlation
- Use OpenTelemetry for standardization

Alerting best practices:
- Alert on symptoms, not causes
- Set actionable thresholds
- Avoid alert fatigue
- Include runbook links
- Use severity levels`,

  userPromptTemplate: `Set up monitoring:

Type: {type}
Stack: {stack}

{userInput}

Workspace files: {workspaceFiles}

Please:
1. Configure logging with proper levels
2. Add key metrics collection
3. Set up health check endpoints
4. Configure alerting rules
5. Add request tracing`,
};
