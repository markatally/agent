/**
 * Skill Registry - Predefined prompts and workflows for common tasks
 *
 * Skills are invoked via slash commands (e.g., /code, /debug, /deploy)
 * Each skill provides structured prompts that guide the agent through specific tasks.
 */

export interface Skill {
  name: string;
  description: string;
  aliases: string[];
  category: SkillCategory;
  systemPrompt: string;
  userPromptTemplate: string;
  requiredTools: string[];
  parameters?: SkillParameter[];
}

export interface SkillParameter {
  name: string;
  description: string;
  required: boolean;
  type: 'string' | 'number' | 'boolean' | 'array';
  default?: any;
}

export type SkillCategory =
  | 'development'
  | 'debugging'
  | 'testing'
  | 'devops'
  | 'documentation'
  | 'analysis'
  | 'data'
  | 'web'
  | 'integration'
  | 'planning';

// Import all skills
import { codeSkill } from './development/code';
import { refactorSkill } from './development/refactor';
import { reviewSkill } from './development/review';
import { apiSkill } from './development/api';
import { promptSkill } from './development/prompt';
import { toolSkill } from './development/tool';
import { authSkill } from './development/auth';
import { componentSkill } from './development/component';
import { debugSkill } from './debugging/debug';
import { fixSkill } from './debugging/fix';
import { testSkill } from './testing/test';
import { coverageSkill } from './testing/coverage';
import { deploySkill } from './devops/deploy';
import { dockerSkill } from './devops/docker';
import { gitSkill } from './devops/git';
import { migrateSkill } from './devops/migrate';
import { ciSkill } from './devops/ci';
import { envSkill } from './devops/env';
import { monitorSkill } from './devops/monitor';
import { docsSkill } from './documentation/docs';
import { apiDocsSkill } from './documentation/api-docs';
import { changelogSkill } from './documentation/changelog';
import { analyzeSkill } from './analysis/analyze';
import { securitySkill } from './analysis/security';
import { scrapeSkill } from './web/scrape';
import { searchSkill } from './web/search';
import { dataSkill } from './data/data';
import { sqlSkill } from './data/sql';
import { mcpSkill } from './integration/mcp';
import { planSkill } from './planning/plan';
import { architectSkill } from './planning/architect';

// Skill registry
export const skills: Map<string, Skill> = new Map([
  // Development
  ['code', codeSkill],
  ['refactor', refactorSkill],
  ['review', reviewSkill],
  ['api', apiSkill],
  ['prompt', promptSkill],
  ['tool', toolSkill],
  ['auth', authSkill],
  ['component', componentSkill],
  // Debugging
  ['debug', debugSkill],
  ['fix', fixSkill],
  // Testing
  ['test', testSkill],
  ['coverage', coverageSkill],
  // DevOps
  ['deploy', deploySkill],
  ['docker', dockerSkill],
  ['git', gitSkill],
  ['migrate', migrateSkill],
  ['ci', ciSkill],
  ['env', envSkill],
  ['monitor', monitorSkill],
  // Documentation
  ['docs', docsSkill],
  ['api-docs', apiDocsSkill],
  ['changelog', changelogSkill],
  // Analysis
  ['analyze', analyzeSkill],
  ['security', securitySkill],
  // Web
  ['scrape', scrapeSkill],
  ['search', searchSkill],
  // Data
  ['data', dataSkill],
  ['sql', sqlSkill],
  // Integration
  ['mcp', mcpSkill],
  // Planning
  ['plan', planSkill],
  ['architect', architectSkill],
]);

// Build alias lookup
const aliasMap: Map<string, string> = new Map();
skills.forEach((skill, name) => {
  skill.aliases.forEach(alias => aliasMap.set(alias, name));
});

/**
 * Get a skill by name or alias
 */
export function getSkill(nameOrAlias: string): Skill | undefined {
  const normalizedName = nameOrAlias.toLowerCase().replace(/^\//, '');

  // Direct match
  if (skills.has(normalizedName)) {
    return skills.get(normalizedName);
  }

  // Alias match
  const skillName = aliasMap.get(normalizedName);
  if (skillName) {
    return skills.get(skillName);
  }

  return undefined;
}

/**
 * List all available skills
 */
export function listSkills(): Skill[] {
  return Array.from(skills.values());
}

/**
 * List skills by category
 */
export function listSkillsByCategory(category: SkillCategory): Skill[] {
  return Array.from(skills.values()).filter(s => s.category === category);
}

/**
 * Format skill help text
 */
export function formatSkillHelp(skill: Skill): string {
  let help = `/${skill.name} - ${skill.description}\n`;

  if (skill.aliases.length > 0) {
    help += `  Aliases: ${skill.aliases.map(a => '/' + a).join(', ')}\n`;
  }

  if (skill.parameters && skill.parameters.length > 0) {
    help += `  Parameters:\n`;
    skill.parameters.forEach(p => {
      const req = p.required ? '(required)' : '(optional)';
      help += `    - ${p.name}: ${p.description} ${req}\n`;
    });
  }

  return help;
}
