import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

process.env.CONFIG_PATH = path.join(process.cwd(), 'tests/fixtures/test-config.json');

import { clearConfigCache } from '../../apps/api/src/services/config';
clearConfigCache();

import { getBrowserManager, resetBrowserManager } from '../../apps/api/src/services/browser';
import { getToolExecutor, clearToolRegistry, type ToolContext } from '../../apps/api/src/services/tools';

describe('Browser execution layer', () => {
  let toolContext: ToolContext;
  let testWorkspace: string;

  beforeAll(async () => {
    testWorkspace = path.join(os.tmpdir(), `mark-browser-test-${Date.now()}`);
    await fs.mkdir(testWorkspace, { recursive: true });
    toolContext = {
      sessionId: 'test-browser-session',
      userId: 'test-user',
      workspaceDir: testWorkspace,
    };
  });

  afterAll(async () => {
    resetBrowserManager();
    clearToolRegistry(toolContext.sessionId);
    try {
      await fs.rm(testWorkspace, { recursive: true, force: true });
    } catch (_) {}
  });

  describe('BrowserManager', () => {
    it('should return singleton instance', () => {
      const manager = getBrowserManager();
      const manager2 = getBrowserManager();
      expect(manager).toBeDefined();
      expect(manager).toBe(manager2);
    });

    it('should report disabled when browser config is absent or disabled', () => {
      const manager = getBrowserManager();
      expect(manager.isEnabled()).toBe(false);
    });

    it('should not allow creating session when disabled', () => {
      const manager = getBrowserManager();
      expect(manager.canCreateSession()).toBe(false);
    });

    it('should return zero session count when no sessions', () => {
      const manager = getBrowserManager();
      expect(manager.getSessionCount()).toBe(0);
    });

    it('should have create, getSession, getPage, destroy methods', () => {
      const manager = getBrowserManager();
      expect(typeof manager.create).toBe('function');
      expect(typeof manager.getSession).toBe('function');
      expect(typeof manager.getPage).toBe('function');
      expect(typeof manager.destroy).toBe('function');
      expect(typeof manager.startScreencast).toBe('function');
      expect(typeof manager.stopScreencast).toBe('function');
    });
  });

  describe('Browser tools when browser disabled', () => {
    it('browser_navigate should return error when browser not available', async () => {
      const executor = getToolExecutor(toolContext);
      const result = await executor.execute('browser_navigate', { url: 'https://example.com' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Browser');
    });

    it('browser_screenshot should return error when browser not available', async () => {
      const executor = getToolExecutor(toolContext);
      const result = await executor.execute('browser_screenshot', {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Browser');
    });

    it('browser_click should return error when browser not available', async () => {
      const executor = getToolExecutor(toolContext);
      const result = await executor.execute('browser_click', { selector: 'button' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Browser');
    });
  });

  describe('Tool registry includes browser tools', () => {
    it('should have browser tools registered', () => {
      const { getToolRegistry } = require('../../apps/api/src/services/tools');
      const registry = getToolRegistry(toolContext);
      const names = registry.getToolNames();
      expect(names).toContain('browser_navigate');
      expect(names).toContain('browser_screenshot');
      expect(names).toContain('browser_click');
      expect(names).toContain('browser_type');
      expect(names).toContain('browser_scroll');
      expect(names).toContain('browser_wait');
      expect(names).toContain('browser_extract');
    });
  });
});
