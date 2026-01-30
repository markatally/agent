import { Skill } from '../index';

export const dockerSkill: Skill = {
  name: 'docker',
  description: 'Create and manage Docker containers',
  aliases: ['container', 'dockerfile', 'compose'],
  category: 'devops',
  requiredTools: ['bash_executor', 'file_reader', 'file_writer'],
  parameters: [
    {
      name: 'action',
      description: 'Action: build, run, compose, optimize',
      required: true,
      type: 'string',
    },
  ],
  systemPrompt: `You are a Docker expert. Your task is to create efficient, secure container configurations.

Dockerfile best practices:
1. Use specific base image tags (not :latest)
2. Order layers by change frequency (least to most)
3. Combine RUN commands to reduce layers
4. Use multi-stage builds for smaller images
5. Don't run as root (use USER directive)
6. Use .dockerignore to exclude unnecessary files
7. Set appropriate HEALTHCHECK
8. Use COPY instead of ADD when possible

Docker Compose best practices:
1. Use version 3.8+ syntax
2. Define resource limits
3. Use named volumes for persistence
4. Set restart policies
5. Use environment files for secrets
6. Define proper networks
7. Use depends_on with healthcheck

Security:
- Scan images for vulnerabilities
- Don't store secrets in images
- Use read-only filesystems where possible
- Limit capabilities
- Use security profiles (seccomp, AppArmor)`,

  userPromptTemplate: `Docker task:

Action: {action}

{userInput}

Workspace files: {workspaceFiles}

Please:
1. Analyze the application structure
2. Create/modify Docker configuration
3. Apply best practices
4. Test the configuration
5. Provide usage instructions`,
};
