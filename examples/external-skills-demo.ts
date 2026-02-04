/**
 * External Skills Demo
 * Demonstrates how to use external skills as product skills
 */

import { getEnhancedSkillProcessor } from '../apps/api/src/services/skills/enhanced-processor';
import { getExternalSkillLoader } from '../apps/api/src/services/external-skills/loader';
import { getDynamicSkillRegistry } from '../apps/api/src/services/skills/dynamic-registry';

async function main() {
  console.log('🚀 External Skills to Product Skills Demo\n');

  // Step 1: List available external skills
  console.log('📋 Step 1: List available external skills');
  console.log('─'.repeat(60));

  const loader = getExternalSkillLoader();
  const externalSkills = await loader.listSkills({
    capabilityLevel: 'EXTERNAL',
    status: 'ACTIVE',
  });

  console.log(`Found ${externalSkills.length} external skills\n`);

  // Show first 5 as examples
  externalSkills.slice(0, 5).forEach((skill, index) => {
    console.log(`${index + 1}. ${skill.name}`);
    console.log(`   ID: ${skill.canonicalId}`);
    console.log(`   Description: ${skill.description}`);
    console.log(`   Pattern: ${skill.invocationPattern}`);
    console.log(`   Category: ${skill.category || 'N/A'}`);
    console.log();
  });

  // Step 2: Enable an external skill
  console.log('🔧 Step 2: Enable an external skill');
  console.log('─'.repeat(60));

  const processor = getEnhancedSkillProcessor();

  // Find a prompt-based skill to enable
  const promptSkill = externalSkills.find((s) => s.invocationPattern === 'prompt');

  if (promptSkill) {
    console.log(`Enabling skill: ${promptSkill.name} (${promptSkill.canonicalId})`);
    const enabled = await processor.enableExternalSkill(promptSkill.canonicalId);

    if (enabled) {
      console.log('✅ Skill enabled successfully!\n');
    } else {
      console.log('❌ Failed to enable skill\n');
      return;
    }
  } else {
    console.log('❌ No prompt-based skills found\n');
    return;
  }

  // Step 3: Use the skill via slash command
  console.log('💬 Step 3: Invoke skill via slash command');
  console.log('─'.repeat(60));

  const command = `/${promptSkill.canonicalId} Create a simple React component`;
  console.log(`Command: ${command}`);

  const invocation = await processor.parseCommandAsync(command);

  if (invocation) {
    console.log('\n📦 Parsed invocation:');
    console.log(`   Skill: ${invocation.skillName}`);
    console.log(`   Input: ${invocation.userInput}`);
    console.log(`   Is External: ${invocation.isExternal}`);
    console.log(`   Parameters:`, invocation.parameters);

    // Execute the skill
    console.log('\n⚡ Executing skill...');

    const result = await processor.executeInvocation(invocation, {
      workspaceFiles: ['src/App.tsx', 'src/components/Button.tsx'],
      additionalContext: {
        framework: 'react',
        language: 'typescript',
      },
    });

    console.log('\n✨ Execution result:');
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('❌ Failed to parse command\n');
  }

  // Step 4: List all skills (product + external)
  console.log('\n📊 Step 4: List all skills (product + external)');
  console.log('─'.repeat(60));

  const allSkills = await processor.getAllSkillsAsync();

  const productSkills = allSkills.filter((s) => !s.isExternal);
  const enabledExternal = allSkills.filter((s) => s.isExternal);

  console.log(`Total skills: ${allSkills.length}`);
  console.log(`  - Product skills: ${productSkills.length}`);
  console.log(`  - External skills (enabled): ${enabledExternal.length}`);

  // Step 5: Get statistics
  console.log('\n📈 Step 5: Skill statistics');
  console.log('─'.repeat(60));

  const stats = await processor.getSkillStats();

  console.log('Statistics:');
  console.log(`  Total: ${stats.totalSkills}`);
  console.log(`  Product: ${stats.productSkills}`);
  console.log(`  External (enabled): ${stats.externalSkills}`);
  console.log(`  External (available): ${stats.enabledExternal}`);

  console.log('\n  By category:');
  Object.entries(stats.categories)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
      console.log(`    ${category}: ${count}`);
    });

  // Step 6: Search skills
  console.log('\n🔍 Step 6: Search skills');
  console.log('─'.repeat(60));

  const searchQuery = 'code';
  console.log(`Searching for: "${searchQuery}"`);

  const searchResults = await processor.searchSkills(searchQuery);

  console.log(`\nFound ${searchResults.length} results:\n`);
  searchResults.slice(0, 5).forEach((skill) => {
    const badge = skill.isExternal ? '🌐 EXTERNAL' : '🏠 PRODUCT';
    console.log(`${badge} /${skill.name} - ${skill.description}`);
  });

  // Step 7: Disable the skill
  console.log('\n🔴 Step 7: Disable the external skill');
  console.log('─'.repeat(60));

  processor.disableExternalSkill(promptSkill.canonicalId);
  console.log(`✅ Skill ${promptSkill.canonicalId} disabled`);

  const finalStats = await processor.getSkillStats();
  console.log(`\nEnabled external skills: ${finalStats.externalSkills}`);

  console.log('\n✅ Demo complete!');
}

// Run the demo
main().catch((error) => {
  console.error('❌ Demo failed:', error);
  process.exit(1);
});
