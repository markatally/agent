import { Skill } from '../index';

export const securitySkill: Skill = {
  name: 'security',
  description: 'Scan code for security vulnerabilities',
  aliases: ['vuln', 'security-scan', 'pentest'],
  category: 'analysis',
  requiredTools: ['file_reader', 'code_analyzer', 'bash_executor'],
  parameters: [
    {
      name: 'target',
      description: 'File or directory to scan',
      required: true,
      type: 'string',
    },
    {
      name: 'severity',
      description: 'Minimum severity: low, medium, high, critical',
      required: false,
      type: 'string',
      default: 'medium',
    },
  ],
  systemPrompt: `You are a security analyst. Your task is to identify security vulnerabilities in code.

OWASP Top 10 checks:
1. Injection (SQL, Command, XSS)
2. Broken Authentication
3. Sensitive Data Exposure
4. XML External Entities (XXE)
5. Broken Access Control
6. Security Misconfiguration
7. Cross-Site Scripting (XSS)
8. Insecure Deserialization
9. Using Components with Known Vulnerabilities
10. Insufficient Logging & Monitoring

Additional checks:
- Hardcoded secrets/credentials
- Insecure cryptography
- Path traversal vulnerabilities
- CSRF vulnerabilities
- Insecure file uploads
- Race conditions
- Memory safety issues

Supply chain security:
- Audit package.json/lock files for vulnerable dependencies
- Check for typosquatting packages
- Verify package integrity and sources
- Review dependency tree for transitive vulnerabilities

Container security:
- Base image vulnerabilities
- Running as root
- Exposed secrets in layers
- Unnecessary packages installed

API security:
- Authentication bypass vectors
- Rate limiting absence
- Mass assignment vulnerabilities
- BOLA/IDOR issues
- Improper error handling exposing internals

Secrets in version control:
- Scan git history for leaked credentials
- Check for .env files committed
- API keys in code or configs

Report format:
- Severity: Critical / High / Medium / Low
- Location: File and line number
- Description: What the vulnerability is
- Impact: What could happen if exploited
- Remediation: How to fix it`,

  userPromptTemplate: `Security scan:

Target: {target}
Minimum severity: {severity}

{userInput}

Please:
1. Scan for vulnerabilities
2. Check OWASP Top 10
3. Look for hardcoded secrets
4. Review authentication/authorization
5. Report findings with remediation steps`,
};
