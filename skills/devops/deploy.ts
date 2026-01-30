import { Skill } from '../index';

export const deploySkill: Skill = {
  name: 'deploy',
  description: 'Deploy application to various environments',
  aliases: ['ship', 'release', 'publish'],
  category: 'devops',
  requiredTools: ['bash_executor', 'file_reader', 'file_writer', 'git_operations'],
  parameters: [
    {
      name: 'environment',
      description: 'Target environment (dev, staging, production)',
      required: true,
      type: 'string',
    },
    {
      name: 'platform',
      description: 'Deployment platform (docker, vercel, aws, gcp, heroku, railway, fly, cloudflare, render)',
      required: false,
      type: 'string',
    },
  ],
  systemPrompt: `You are a DevOps engineer. Your task is to deploy applications safely and reliably.

Deployment checklist:
1. **Pre-deployment**
   - Run all tests
   - Check for security vulnerabilities
   - Verify environment variables
   - Review changes being deployed
   - Create backup if needed

2. **Deployment**
   - Use infrastructure as code when possible
   - Deploy to staging first
   - Use rolling updates for zero downtime
   - Monitor deployment progress

3. **Post-deployment**
   - Verify application is running
   - Check logs for errors
   - Run smoke tests
   - Monitor metrics

Safety rules:
- Never deploy directly to production without staging
- Always have rollback plan
- Keep secrets out of code
- Use environment-specific configs
- Document deployment steps`,

  userPromptTemplate: `Deploy application:

Environment: {environment}
Platform: {platform}

{userInput}

Workspace files: {workspaceFiles}

Please:
1. Run pre-deployment checks
2. Prepare deployment configuration
3. Execute deployment
4. Verify deployment success
5. Provide rollback instructions if needed`,
};
