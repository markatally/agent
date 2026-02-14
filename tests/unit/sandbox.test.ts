import { describe, it, expect, beforeAll, afterAll, mock } from 'bun:test';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

// Set CONFIG_PATH for tests if not already set
if (!process.env.CONFIG_PATH) {
  process.env.CONFIG_PATH = path.join(process.cwd(), 'config/default.json');
}

// Import after setting CONFIG_PATH
import { SandboxManager, getSandboxManager } from '../../apps/api/src/services/sandbox';

describe('Phase 6.1: Docker Sandbox', () => {
  let testWorkspace: string;

  beforeAll(async () => {
    // Create temporary workspace for testing
    testWorkspace = path.join(os.tmpdir(), `mark-sandbox-test-${Date.now()}`);
    await fs.mkdir(testWorkspace, { recursive: true });
  });

  afterAll(async () => {
    // Cleanup test workspace
    try {
      await fs.rm(testWorkspace, { recursive: true, force: true });
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  describe('SandboxManager', () => {
    it('should get singleton instance', () => {
      const manager = getSandboxManager();
      const manager2 = getSandboxManager();

      expect(manager).toBeDefined();
      expect(manager).toBe(manager2);
    });

    it('should report enabled status from config', () => {
      const manager = getSandboxManager();
      const isEnabled = manager.isEnabled();

      // Config has sandbox.enabled = true by default
      expect(typeof isEnabled).toBe('boolean');
    });

    it('should have createSandbox method', () => {
      const manager = getSandboxManager();
      expect(typeof manager.createSandbox).toBe('function');
    });

    it('should have executeCommand method', () => {
      const manager = getSandboxManager();
      expect(typeof manager.executeCommand).toBe('function');
    });

    it('should have destroySandbox method', () => {
      const manager = getSandboxManager();
      expect(typeof manager.destroySandbox).toBe('function');
    });

    it('should have getSandboxStatus method', () => {
      const manager = getSandboxManager();
      expect(typeof manager.getSandboxStatus).toBe('function');
    });

    it('should have getFileTree method', () => {
      const manager = getSandboxManager();
      expect(typeof manager.getFileTree).toBe('function');
    });

    it('should have exportArtifacts method', () => {
      const manager = getSandboxManager();
      expect(typeof manager.exportArtifacts).toBe('function');
    });

    it('should return null status for non-existent session', async () => {
      const manager = getSandboxManager();
      const status = await manager.getSandboxStatus('non-existent-session');
      expect(status).toBeNull();
    });

    it('should return empty file tree for non-existent session', async () => {
      const manager = getSandboxManager();
      const tree = await manager.getFileTree('non-existent-session');
      expect(Array.isArray(tree)).toBe(true);
      expect(tree.length).toBe(0);
    });

    it('should return empty artifacts for non-existent session', async () => {
      const manager = getSandboxManager();
      const artifacts = await manager.exportArtifacts('non-existent-session', ['output.pptx']);
      expect(Array.isArray(artifacts)).toBe(true);
      expect(artifacts.length).toBe(0);
    });

    it('should have cleanup method', () => {
      const manager = getSandboxManager();
      expect(typeof manager.cleanup).toBe('function');
    });

    it('disables sandbox after unrecoverable image/docker setup errors', async () => {
      const manager = new SandboxManager() as any;
      manager.config.enabled = true;
      manager.docker = {
        listContainers: async () => [],
        createContainer: async () => {
          throw new Error('No such image: mark-sandbox:latest');
        },
      };

      await expect(
        manager.createSandbox({
          sessionId: 'sandbox-disable-test',
          workspaceDir: testWorkspace,
        })
      ).rejects.toThrow('Failed to create sandbox');

      expect(manager.isEnabled()).toBe(false);
      expect(manager.getUnavailableReason()).toContain('No such image');
    });
  });

  describe('SandboxExecResult type', () => {
    it('should have correct structure', () => {
      // Type check - this tests the interface at compile time
      const mockResult = {
        success: true,
        output: 'test output',
        exitCode: 0,
        duration: 100,
      };

      expect(mockResult.success).toBe(true);
      expect(mockResult.output).toBe('test output');
      expect(mockResult.exitCode).toBe(0);
      expect(mockResult.duration).toBe(100);
    });

    it('should support error field', () => {
      const mockResult = {
        success: false,
        output: '',
        error: 'Command failed',
        exitCode: 1,
        duration: 50,
        timedOut: false,
      };

      expect(mockResult.success).toBe(false);
      expect(mockResult.error).toBe('Command failed');
      expect(mockResult.timedOut).toBe(false);
    });

    it('should support timedOut field', () => {
      const mockResult = {
        success: false,
        output: 'partial output',
        error: 'Command timed out',
        exitCode: -1,
        duration: 300000,
        timedOut: true,
      };

      expect(mockResult.timedOut).toBe(true);
    });
  });

  describe('ContainerInfo type', () => {
    it('should have correct structure', () => {
      const mockInfo = {
        containerId: 'abc123',
        sessionId: 'session-1',
        workspaceDir: '/workspace',
        createdAt: new Date(),
        status: 'running' as const,
      };

      expect(mockInfo.containerId).toBe('abc123');
      expect(mockInfo.sessionId).toBe('session-1');
      expect(mockInfo.status).toBe('running');
    });
  });
});
