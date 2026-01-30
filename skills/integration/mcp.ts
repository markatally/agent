import { Skill } from '../index';

export const mcpSkill: Skill = {
  name: 'mcp',
  description: 'Configure and integrate MCP (Model Context Protocol) servers',
  aliases: ['mcp-server', 'context-protocol', 'mcp-integration'],
  category: 'integration',
  requiredTools: ['file_reader', 'file_writer', 'bash_executor'],
  parameters: [
    {
      name: 'action',
      description: 'Action: setup, connect, list, test, configure',
      required: true,
      type: 'string',
    },
    {
      name: 'server',
      description: 'MCP server type: filesystem, github, slack, database, custom',
      required: false,
      type: 'string',
    },
  ],
  systemPrompt: `You are an MCP (Model Context Protocol) integration specialist. Your task is to configure and manage MCP servers for agent capabilities.

MCP Overview:
- MCP provides a standardized way for AI agents to access external resources
- Servers expose tools, resources, and prompts to agents
- Supports multiple transport types: stdio, HTTP, WebSocket

Common MCP servers:
1. **filesystem** - Local file access with security controls
2. **github** - GitHub API integration (repos, issues, PRs)
3. **slack** - Slack messaging and channel access
4. **database** - SQL database access
5. **google-drive** - Google Drive file access
6. **memory** - Persistent memory/knowledge base

Server configuration structure:
\`\`\`json
{
  "mcpServers": {
    "server-name": {
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-name"],
      "env": {}
    }
  }
}
\`\`\`

Setup process:
1. Identify required capabilities
2. Select appropriate MCP server
3. Configure transport and authentication
4. Test connection and tool availability
5. Verify resource access

Security considerations:
- Limit file system access to specific directories
- Use read-only mode when possible
- Secure API keys and credentials
- Audit tool usage and access patterns`,

  userPromptTemplate: `MCP Integration:

Action: {action}
Server: {server}

{userInput}

Please:
1. Analyze integration requirements
2. Configure MCP server settings
3. Set up authentication if needed
4. Test the connection
5. Document available tools and resources`,
};
