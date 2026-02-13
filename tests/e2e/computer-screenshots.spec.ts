/**
 * E2E: Inspector computer viewport and step screenshots in PPT pipeline
 *
 * Verifies:
 * 1. Inspector shows computer viewport area (placeholder or screenshot) when open
 * 2. After sending a PPT-style message, placeholder appears and screenshots can appear per step
 */

import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

async function login(page: Page) {
  await page.request.post('/api/auth/register', {
    data: { email: 'test@example.com', password: 'test-password' },
  });
  await page.goto('/');
  const chatInput = page.locator('[data-testid="chat-input"]');
  if (await chatInput.isVisible()) return;
  await page.goto('/login');
  await page.fill('input[type="email"]', 'test@example.com');
  await page.fill('input[type="password"]', 'test-password');
  await page.click('button:has-text("Log in")');
  await page.waitForURL(/\/chat/);
  await page.waitForSelector('[data-testid="chat-input"]', { timeout: 30000 });
}

async function openInspector(page: Page) {
  const inspectorHeading = page.getByText('Inspector');
  const openInspector = page.getByRole('button', { name: /open inspector/i });
  if ((await inspectorHeading.count()) === 0 && (await openInspector.count()) > 0) {
    await openInspector.click();
  }
  await expect(inspectorHeading).toBeVisible({ timeout: 10000 });
}

test.describe('Inspector computer viewport and step screenshots', () => {
  test.describe.configure({ mode: 'serial' });
  test('inspector shows viewport area (placeholder or screenshot or Sandbox)', async ({
    page,
  }) => {
    await login(page);

    const newChatBtn = page.locator('[data-testid="new-chat-button"]');
    await newChatBtn.click();
    await page.waitForURL(/\/chat\/[^/]+/, { timeout: 15000 });

    await openInspector(page);

    const placeholder = page.locator('[data-testid="computer-viewport-placeholder"]');
    const viewport = page.locator('[data-testid="browser-viewport"]');
    const screenshotImg = page.locator('[data-testid="browser-viewport-screenshot"]');
    const sandboxSection = page.getByText('Sandbox:');

    await expect(
      placeholder.or(viewport).or(screenshotImg).or(sandboxSection)
    ).toBeVisible({ timeout: 10000 });
  });

  test('sending PPT message shows placeholder then step screenshots can appear', async ({
    page,
  }) => {
    test.skip(!!process.env.CI, 'skip in CI');
    await login(page);

    const newChatBtn = page.locator('[data-testid="new-chat-button"]');
    await newChatBtn.click();
    await page.waitForURL(/\/chat\/[^/]+/, { timeout: 15000 });

    const chatInput = page.locator('[data-testid="chat-input"]');
    await expect(chatInput).toBeVisible({ timeout: 10000 });

    await chatInput.fill('Make a 1-slide PPT about cats.');
    await chatInput.press('Enter');

    await openInspector(page);

    const placeholder = page.locator('[data-testid="computer-viewport-placeholder"]');
    const screenshotImg = page.locator('[data-testid="browser-viewport-screenshot"]');
    const browserOff = page.getByText('Browser view is off');
    await expect(placeholder.or(screenshotImg).or(browserOff)).toBeVisible({ timeout: 20000 });

    const snapshotUnavailable = page.getByText(/Snapshot unavailable for this step/i);
    const noVisualSteps = page.getByText(/No visual steps yet/i);
    await expect
      .poll(
        async () => {
          const screenshotVisible = await screenshotImg.first().isVisible().catch(() => false);
          const browserOffVisible = await browserOff.first().isVisible().catch(() => false);
          const snapshotUnavailableVisible = await snapshotUnavailable.first().isVisible().catch(() => false);
          const noVisualStepsVisible = await noVisualSteps.first().isVisible().catch(() => false);
          return screenshotVisible || browserOffVisible || snapshotUnavailableVisible || noVisualStepsVisible;
        },
        { timeout: 90000 }
      )
      .toBe(true);
  });

  test('complex PPT prompt validates computer, reasoning, reply, and download artifact', async ({
    page,
  }) => {
    test.setTimeout(480000);
    test.skip(!!process.env.CI, 'skip in CI');
    await login(page);

    const newChatBtn = page.locator('[data-testid="new-chat-button"]');
    await newChatBtn.click();
    await page.waitForURL(/\/chat\/[^/]+/, { timeout: 15000 });

    const chatInput = page.locator('[data-testid="chat-input"]');
    await expect(chatInput).toBeVisible({ timeout: 10000 });

    const complexPrompt =
      'Make a PPT based on top 5 TimeSeries Forecasting ML academic / research papers.';
    await chatInput.fill(complexPrompt);
    await chatInput.press('Enter');

    await openInspector(page);

    const placeholder = page.locator('[data-testid="computer-viewport-placeholder"]');
    const screenshotImg = page.locator('[data-testid="browser-viewport-screenshot"]');
    const browserOff = page.getByText('Browser view is off');
    await expect(placeholder.or(screenshotImg).or(browserOff)).toBeVisible({ timeout: 20000 });

    const reasoningTimeline = page.locator('[data-testid="reasoning-trace-timeline"]');
    const noReasoningText = page.getByText(/No reasoning trace yet/i);
    await expect(reasoningTimeline.or(noReasoningText)).toBeVisible({ timeout: 90000 });

    const assistantMessages = page.locator('[data-testid="assistant-message"]');
    const stopBtn = page.getByRole('button', { name: /stop response/i });
    await expect(assistantMessages.last().or(stopBtn)).toBeVisible({ timeout: 180000 });

    const sendBtn = page.getByRole('button', { name: /send message/i });
    await expect(sendBtn).toBeVisible({ timeout: 360000 });
    await expect(assistantMessages.last()).toBeVisible({ timeout: 120000 });
    await expect
      .poll(
        async () => ((await assistantMessages.last().textContent()) || '').trim().length,
        { timeout: 180000 }
      )
      .toBeGreaterThan(40);

    await expect
      .poll(
        async () => {
          const replyText = ((await assistantMessages.last().textContent()) || '').toLowerCase();
          const hasDownload = await page.getByRole('button', { name: /^download$/i }).count();
          const hasPptMention = replyText.includes('.pptx') || replyText.includes('presentation');
          return hasDownload > 0 || hasPptMention;
        },
        { timeout: 180000 }
      )
      .toBe(true);

    const downloadBtn = page.getByRole('button', { name: /^download$/i }).first();
    await expect(downloadBtn).toBeVisible({ timeout: 180000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 120000 });
    await downloadBtn.click();
    const download = await downloadPromise;
    const suggestedFilename = download.suggestedFilename();
    expect(suggestedFilename.toLowerCase()).toContain('.pptx');

    const downloadDir = '/tmp/markagent-e2e-downloads';
    mkdirSync(downloadDir, { recursive: true });
    const savedPath = join(downloadDir, suggestedFilename);
    await download.saveAs(savedPath);
  });
});
