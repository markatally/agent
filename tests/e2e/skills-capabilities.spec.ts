/**
 * E2E Tests for Skills Capabilities
 * 
 * Prerequisites:
 * 1. Install Playwright: bun add -D @playwright/test
 * 2. Install browsers: bunx playwright install
 * 3. Create playwright.config.ts (see below)
 * 4. Run tests: bunx playwright test
 */

import { test, expect, type Page } from '@playwright/test';

// Helper functions
async function login(page: Page) {
  // Ensure test user exists
  await page.request.post('/api/auth/register', {
    data: {
      email: 'test@example.com',
      password: 'test-password',
    },
  });

  await page.goto('/');
  
  // Check if already logged in
  const chatInput = page.locator('[data-testid="chat-input"]');
  if (await chatInput.isVisible()) {
    return; // Already logged in
  }

  // Navigate to login
  await page.goto('/login');
  
  // Fill login form
  await page.fill('input[type="email"]', 'test@example.com');
  await page.fill('input[type="password"]', 'test-password');
  await page.click('button:has-text("Log in")');
  
  // Wait for redirect to chat
  await page.waitForURL(/\/chat/);
  await page.waitForSelector('[data-testid="chat-input"]', { timeout: 30000 });
}

async function openSkillsModal(page: Page) {
  // Click settings/gear icon
  await page.waitForSelector('[data-testid="settings-button"]', { timeout: 30000 });
  await page.click('[data-testid="settings-button"]');
  
  // Click Skills option
  await page.click('text=Skills');
  
  // Wait for modal to open
  await expect(page.locator('[role="dialog"]')).toBeVisible();
}

async function enableSkill(page: Page, skillName: string) {
  await openSkillsModal(page);

  // Ensure we are in the "All" scope to find any skill
  const allTab = page.locator('button:has-text("All")').first();
  if (await allTab.isVisible()) {
    await allTab.click();
  }
  
  // Search for skill
  await page.fill('input[placeholder*="Search"]', skillName);
  
  // Wait for skill to appear
  const skillCard = page.locator('[data-testid="skill-card"]').filter({ hasText: skillName });
  await expect(skillCard).toBeVisible();
  
  const addButton = skillCard.locator('button:has-text("Add")');
  if (await addButton.count()) {
    await addButton.click();
  } else {
    const toggle = skillCard.locator('button[role="switch"]');
    if (await toggle.count()) {
      const state = await toggle.getAttribute('data-state');
      if (state === 'unchecked') {
        await toggle.click();
      }
    }
  }
  
  // Save changes
  await page.click('button:has-text("Save")');
  
  // Wait for modal to close
  await expect(page.locator('[role="dialog"]')).not.toBeVisible();
}

async function disableSkill(page: Page, skillName: string) {
  await openSkillsModal(page);
  
  // Find skill and click remove button
  await page.locator(`text=${skillName}`).locator('..').locator('[title="Remove skill"]').click();
  
  // Save changes
  await page.click('button:has-text("Save")');
  
  // Wait for modal to close
  await expect(page.locator('[role="dialog"]')).not.toBeVisible();
}

async function removeAllSkills(page: Page): Promise<boolean> {
  await openSkillsModal(page);
  const removeButtons = page.locator('[title="Remove skill"]');
  let safety = 0;
  let removed = false;
  while ((await removeButtons.count()) > 0 && safety < 25) {
    await removeButtons.first().click();
    removed = true;
    safety += 1;
  }
  return removed;
}

async function startNewChat(page: Page) {
  await page.click('[data-testid="new-chat-button"]');
  await page.waitForTimeout(500); // Wait for new chat to initialize
}

async function sendMessage(page: Page, message: string) {
  const input = page.locator('[data-testid="chat-input"]');
  await input.fill(message);
  await input.press('Enter');
  
  // Wait for response to start appearing
  await page.waitForSelector('[data-testid="assistant-message"]', { timeout: 30000 });
}

async function getLastAssistantMessage(page: Page): Promise<string> {
  const messages = await page.locator('[data-testid="assistant-message"]').all();
  const lastMessage = messages[messages.length - 1];
  return await lastMessage.textContent() || '';
}

test.describe('Skills Capabilities E2E', () => {
  test.describe.configure({ mode: 'serial' });

  test.describe('Agent Skill Capabilities', () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
    });

  test('agent should list only enabled skills', async ({ page }) => {
    // Clear all skills first
    const removed = await removeAllSkills(page);
    await page.click(removed ? 'button:has-text("Save")' : 'button:has-text("Cancel")');
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();

    // Enable a specific skill
    await enableSkill(page, '1:1 Meeting Template');
    
    // Start new chat
    await startNewChat(page);
    
    // Ask about skills
    await sendMessage(page, 'what skills do you have');
    
    // Verify response contains the enabled skill
    await page.waitForTimeout(3000); // Wait for response to complete
    const response = await getLastAssistantMessage(page);
    
    expect(response.toLowerCase()).toContain('1:1 meeting template');
    expect(response.toLowerCase()).not.toContain('powerpoint');
    expect(response.toLowerCase()).not.toContain('amplitude');
  });

  test('agent should update when skills change mid-session', async ({ page }) => {
    // Start with one skill
    const removed = await removeAllSkills(page);
    await page.click(removed ? 'button:has-text("Save")' : 'button:has-text("Cancel")');
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();

    await enableSkill(page, '1:1 Meeting Template');
    
    // Start new chat and ask
    await startNewChat(page);
    await sendMessage(page, 'what can you do');
    await page.waitForTimeout(3000);
    
    const response1 = await getLastAssistantMessage(page);
    expect(response1.toLowerCase()).toContain('1:1 meeting template');
    
    // Add another skill
    await enableSkill(page, 'Amplitude');
    
    // Start NEW chat (important - fresh context)
    await startNewChat(page);
    await sendMessage(page, 'what can you do');
    await page.waitForTimeout(3000);
    
    // Verify both skills appear
    const response2 = await getLastAssistantMessage(page);
    expect(response2.toLowerCase()).toContain('1:1 meeting template');
    expect(response2.toLowerCase()).toContain('amplitude');
  });

  test('agent should show no skills when all disabled', async ({ page }) => {
    // Remove all skills
    const removed = await removeAllSkills(page);
    await page.click(removed ? 'button:has-text("Save")' : 'button:has-text("Cancel")');
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    
    // Start new chat
    await startNewChat(page);
    await sendMessage(page, 'what skills are available');
    await page.waitForTimeout(3000);
    
    const response = await getLastAssistantMessage(page);
    expect(response.toLowerCase()).toContain('no');
    expect(response.toLowerCase()).toContain('skill');
  });

  test('agent should not mention internal tools', async ({ page }) => {
    // Enable a skill
    await enableSkill(page, '1:1 Meeting Template');
    
    // Start new chat
    await startNewChat(page);
    await sendMessage(page, 'what are your capabilities');
    await page.waitForTimeout(3000);
    
    const response = await getLastAssistantMessage(page);
    
    // Should NOT mention internal tools
    expect(response.toLowerCase()).not.toContain('file_reader');
    expect(response.toLowerCase()).not.toContain('file_writer');
    expect(response.toLowerCase()).not.toContain('bash_executor');
    expect(response.toLowerCase()).not.toContain('web_search');
    expect(response.toLowerCase()).not.toContain('ppt_generator');
    
    // SHOULD mention the enabled skill
    expect(response.toLowerCase()).toContain('1:1 meeting template');
  });
  });

  test.describe('Skills Modal Scrolling', () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
    });

  test('skills modal should be scrollable with many skills', async ({ page }) => {
    await openSkillsModal(page);
    
    // Verify modal is visible
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    
    // Check for scroll area
    const scrollArea = page.locator('[data-testid="skills-scroll"]');
    await expect(scrollArea).toBeVisible();
    
    // Try to scroll (if enough skills exist)
    const initialScrollTop = await scrollArea.evaluate((el) => el.scrollTop);
    await scrollArea.evaluate((el) => {
      el.scrollTop = 100;
    });
    
    // Wait a bit for scroll to apply
    await page.waitForTimeout(100);
    
    const newScrollTop = await scrollArea.evaluate((el) => el.scrollTop);
    
    // If there's content to scroll, it should have moved
    if (await scrollArea.evaluate((el) => el.scrollHeight > el.clientHeight)) {
      expect(newScrollTop).toBeGreaterThan(initialScrollTop);
    }
  });

  test('skills modal should have fixed height', async ({ page }) => {
    await openSkillsModal(page);
    
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    
    // Check modal has fixed height class
    const className = await modal.getAttribute('class');
    expect(className).toContain('h-[80vh]');
  });

  test('skills modal should display all available skills', async ({ page }) => {
    await openSkillsModal(page);
    
    // Count skill items
    const skillItems = page.locator('[role="dialog"] .border.rounded-lg');
    const count = await skillItems.count();
    
    // Should have at least a few skills
    expect(count).toBeGreaterThan(0);
  });
  });
});
