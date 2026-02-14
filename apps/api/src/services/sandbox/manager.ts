/**
 * Sandbox Manager
 * Manages Docker containers for isolated code execution per session
 */

import Docker from 'dockerode';
import fs from 'fs';
import path from 'path';
import type {
  SandboxConfig,
  SandboxExecResult,
  ContainerInfo,
  CreateSandboxOptions,
  ExecOptions,
  SandboxArtifactInfo,
  SandboxFileTreeNode,
} from './types';
import { getConfig } from '../config';

const DEFAULT_IMAGE = 'mark-sandbox:latest';

/**
 * Get Docker socket path, checking common locations
 * Supports Docker Desktop, Colima, Podman, and standard Linux/macOS setups
 */
function getDockerSocketOptions(): Docker.DockerOptions | undefined {
  // Check Colima socket first on macOS (common setup)
  const colimaSocket = `${process.env.HOME}/.colima/default/docker.sock`;
  try {
    const exists = fs.existsSync(colimaSocket);
    console.log(`[Sandbox] Checking Colima socket: ${colimaSocket} -> ${exists ? 'FOUND' : 'not found'}`);
    if (exists) {
      console.log(`[Sandbox] Using Colima Docker socket: ${colimaSocket}`);
      return { socketPath: colimaSocket };
    }
  } catch {
    // Continue checking other paths
  }

  // Check DOCKER_HOST environment variable (but ignore if it points to /var/run/docker.sock on macOS)
  const dockerHost = process.env.DOCKER_HOST;
  if (dockerHost) {
    console.log(`[Sandbox] DOCKER_HOST is set: ${dockerHost}`);
    if (dockerHost.startsWith('unix://')) {
      const socketPath = dockerHost.replace('unix://', '');
      // Don't use /var/run/docker.sock on macOS (Linux-only path)
      if (process.platform === 'darwin' && socketPath === '/var/run/docker.sock') {
        console.log(`[Sandbox] Ignoring DOCKER_HOST (${socketPath}) on macOS - checking for Colima...`);
      } else {
        console.log(`[Sandbox] Using custom socket: ${socketPath}`);
        return { socketPath };
      }
    }
    if (dockerHost.startsWith('tcp://')) {
      const url = new URL(dockerHost.replace('tcp://', 'http://'));
      console.log(`[Sandbox] Using TCP: ${url.hostname}:${url.port || '2375'}`);
      return { host: url.hostname, port: parseInt(url.port || '2375', 10) };
    }
  }

  // Other common socket locations
  const socketPaths = [
    `${process.env.HOME}/.docker/run/docker.sock`, // Docker Desktop newer versions (macOS/Windows)
    '/var/run/docker.sock', // Standard Linux (skip on macOS, handled above)
    `${process.env.HOME}/Library/Containers/com.docker.docker/Data/raw.sock`, // Docker Desktop (older macOS)
    '/run/docker.sock', // Some Linux distros
    `${process.env.HOME}/local/share/containers/podman/machine/podman.sock`, // Podman
  ];

  for (const socketPath of socketPaths) {
    try {
      const exists = fs.existsSync(socketPath);
      console.log(`[Sandbox] Checking socket: ${socketPath} -> ${exists ? 'FOUND' : 'not found'}`);
      if (exists) {
        console.log(`[Sandbox] Using Docker socket: ${socketPath}`);
        return { socketPath };
      }
    } catch (error) {
      console.log(`[Sandbox] Error checking ${socketPath}:`, error);
      // Continue checking other paths
    }
  }

  // Return undefined to let dockerode use its defaults
  console.warn('[Sandbox] No Docker socket found. Dockerode will use TCP defaults (http://localhost).');
  console.warn('[Sandbox] Tip: Set DOCKER_HOST=unix:///path/to/docker.sock to specify socket path.');
  return undefined;
}

/**
 * SandboxManager - Manages Docker containers for session isolation
 */
export class SandboxManager {
  private docker: Docker;
  private containers: Map<string, ContainerInfo> = new Map();
  private config: SandboxConfig;
  private unavailableReason: string | null = null;

  constructor() {
    const dockerOptions = getDockerSocketOptions();
    this.docker = new Docker(dockerOptions);
    const appConfig = getConfig();
    this.config = {
      enabled: appConfig.sandbox.enabled,
      memory: appConfig.sandbox.memory,
      cpu: appConfig.sandbox.cpu,
      timeout: appConfig.sandbox.timeout,
      diskSpace: appConfig.sandbox.diskSpace,
      networkAccess: appConfig.sandbox.networkAccess,
      image: (appConfig.sandbox as any).image || DEFAULT_IMAGE,
    };
  }

  /**
   * Check if sandbox is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled && this.unavailableReason === null;
  }

  getUnavailableReason(): string | null {
    return this.unavailableReason;
  }

  /**
   * Create a sandbox container for a session
   */
  async createSandbox(options: CreateSandboxOptions): Promise<ContainerInfo> {
    const { sessionId, workspaceDir, env = {} } = options;

    // Check if container already exists in our map
    if (this.containers.has(sessionId)) {
      const existing = this.containers.get(sessionId)!;
      if (existing.status === 'running') {
        return existing;
      }
      // Clean up stopped container
      await this.destroySandbox(sessionId);
    }

    // Also check if a Docker container with this name already exists
    // (can happen if server restarted without proper cleanup)
    const containerName = `mark-sandbox-${sessionId}`;
    try {
      const existingContainers = await this.docker.listContainers({
        all: true,
        filters: { name: [containerName] },
      });
      if (existingContainers.length > 0) {
        console.log(`[Sandbox] Found orphaned container ${containerName}, removing...`);
        for (const containerInfo of existingContainers) {
          try {
            const container = this.docker.getContainer(containerInfo.Id);
            await container.remove({ force: true });
            console.log(`[Sandbox] Removed orphaned container ${containerInfo.Id}`);
          } catch (removeError: any) {
            console.warn(`[Sandbox] Failed to remove orphaned container: ${removeError.message}`);
          }
        }
      }
    } catch (listError: any) {
      console.warn(`[Sandbox] Failed to check for orphaned containers: ${listError.message}`);
    }

    try {
      // Parse memory limit (e.g., "512MB" -> 512 * 1024 * 1024)
      const memoryBytes = this.parseMemory(this.config.memory);

      // Parse CPU limit (e.g., "1" -> 1e9 nanocpus)
      const cpuNanoCpus = parseFloat(this.config.cpu) * 1e9;

      // Create container
      const container = await this.docker.createContainer({
        Image: this.config.image || DEFAULT_IMAGE,
        name: `mark-sandbox-${sessionId}`,
        Tty: true,
        Env: [
          `SESSION_ID=${sessionId}`,
          `HOME=/workspace`,
          `USER=mark`,
          ...Object.entries(env).map(([k, v]) => `${k}=${v}`),
        ],
        HostConfig: {
          // Resource limits
          Memory: memoryBytes,
          NanoCpus: cpuNanoCpus,
          // Storage limit (via tmpfs)
          Tmpfs: {
            '/tmp': `size=${this.config.diskSpace}`,
          },
          // Network isolation
          NetworkMode: this.config.networkAccess ? 'bridge' : 'none',
          // Mount workspace
          Binds: [`${workspaceDir}:/workspace:rw`],
          // Security options
          SecurityOpt: ['no-new-privileges:true'],
          // Auto-remove on exit
          AutoRemove: false,
          // Read-only root filesystem (except mounted dirs)
          ReadonlyRootfs: false,
        },
        WorkingDir: '/workspace',
        User: 'mark',
      });

      // Start the container
      await container.start();

      const info: ContainerInfo = {
        containerId: container.id,
        sessionId,
        workspaceDir,
        createdAt: new Date(),
        status: 'running',
      };

      this.containers.set(sessionId, info);
      return info;
    } catch (error: any) {
      console.error(`Failed to create sandbox for session ${sessionId}:`, error);
      if (this.shouldDisableSandbox(error)) {
        this.unavailableReason = this.extractSandboxErrorMessage(error);
        console.warn(
          `[Sandbox] Disabling sandbox for this process due to unrecoverable setup error: ${this.unavailableReason}`
        );
      }
      throw new Error(`Failed to create sandbox: ${error.message}`);
    }
  }

  private shouldDisableSandbox(error: unknown): boolean {
    const message = this.extractSandboxErrorMessage(error).toLowerCase();
    return (
      message.includes('no such image') ||
      message.includes('cannot connect to the docker daemon') ||
      message.includes('docker daemon is not running')
    );
  }

  private extractSandboxErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  /**
   * Execute a command in a session's sandbox
   */
  async executeCommand(
    sessionId: string,
    options: ExecOptions
  ): Promise<SandboxExecResult> {
    const startTime = Date.now();
    const { command, workingDir = '/workspace', timeout } = options;

    // Get or create container
    let containerInfo = this.containers.get(sessionId);
    if (!containerInfo || containerInfo.status !== 'running') {
      throw new Error(`No running sandbox for session ${sessionId}`);
    }

    try {
      const container = this.docker.getContainer(containerInfo.containerId);

      // Create exec instance
      const exec = await container.exec({
        Cmd: ['sh', '-c', command],
        WorkingDir: workingDir,
        AttachStdout: true,
        AttachStderr: true,
        Env: options.env
          ? Object.entries(options.env).map(([k, v]) => `${k}=${v}`)
          : undefined,
      });

      // Execute with timeout
      const execTimeout = (timeout || this.config.timeout) * 1000;
      const result = await this.executeWithTimeout(exec, execTimeout);

      return {
        success: result.exitCode === 0,
        output: result.output,
        error: result.error,
        exitCode: result.exitCode,
        duration: Date.now() - startTime,
        timedOut: result.timedOut,
      };
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: error.message || 'Command execution failed',
        exitCode: -1,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout(
    exec: Docker.Exec,
    timeoutMs: number
  ): Promise<{
    output: string;
    error: string;
    exitCode: number;
    timedOut: boolean;
  }> {
    return new Promise(async (resolve) => {
      let timedOut = false;
      let stdout = '';
      let stderr = '';

      // Timeout handler
      const timeoutId = setTimeout(() => {
        timedOut = true;
        resolve({
          output: stdout,
          error: 'Command timed out',
          exitCode: -1,
          timedOut: true,
        });
      }, timeoutMs);

      try {
        const stream = await exec.start({ Detach: false, Tty: false });

        // Demux stdout/stderr
        await new Promise<void>((resolveStream) => {
          stream.on('data', (chunk: Buffer) => {
            // Docker multiplexes stdout/stderr with an 8-byte header
            // For Tty: false, we need to demux
            const data = chunk.toString('utf8');
            stdout += data;
          });

          stream.on('end', resolveStream);
          stream.on('error', () => resolveStream());
        });

        if (timedOut) return;

        // Get exit code
        const inspect = await exec.inspect();
        clearTimeout(timeoutId);

        resolve({
          output: stdout.trim(),
          error: stderr.trim(),
          exitCode: inspect.ExitCode ?? 0,
          timedOut: false,
        });
      } catch (error: any) {
        if (timedOut) return;
        clearTimeout(timeoutId);
        resolve({
          output: stdout,
          error: error.message,
          exitCode: -1,
          timedOut: false,
        });
      }
    });
  }

  /**
   * Destroy a session's sandbox container
   */
  async destroySandbox(sessionId: string): Promise<void> {
    const containerInfo = this.containers.get(sessionId);
    if (!containerInfo) return;

    try {
      const container = this.docker.getContainer(containerInfo.containerId);

      // Stop container if running
      try {
        await container.stop({ t: 5 });
      } catch {
        // Container might already be stopped
      }

      // Remove container
      await container.remove({ force: true });
    } catch (error: any) {
      console.error(`Failed to destroy sandbox for session ${sessionId}:`, error);
    } finally {
      this.containers.delete(sessionId);
    }
  }

  /**
   * Get sandbox status for a session
   */
  async getSandboxStatus(sessionId: string): Promise<ContainerInfo | null> {
    const containerInfo = this.containers.get(sessionId);
    if (!containerInfo) return null;

    try {
      const container = this.docker.getContainer(containerInfo.containerId);
      const inspect = await container.inspect();

      containerInfo.status = inspect.State.Running
        ? 'running'
        : inspect.State.ExitCode !== 0
        ? 'error'
        : 'stopped';

      return containerInfo;
    } catch {
      this.containers.delete(sessionId);
      return null;
    }
  }

  /**
   * Get a snapshot of the sandbox workspace file tree
   */
  async getFileTree(sessionId: string): Promise<SandboxFileTreeNode[]> {
    const containerInfo = this.containers.get(sessionId);
    if (!containerInfo) return [];

    const rootDir = containerInfo.workspaceDir;
    const walk = async (currentPath: string): Promise<SandboxFileTreeNode[]> => {
      const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
      const nodes: SandboxFileTreeNode[] = [];

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        const relPath = path.relative(rootDir, fullPath);
        if (entry.isDirectory()) {
          const children = await walk(fullPath);
          nodes.push({
            path: relPath || entry.name,
            type: 'directory',
            children,
          });
        } else {
          const stat = await fs.promises.stat(fullPath);
          nodes.push({
            path: relPath || entry.name,
            type: 'file',
            size: stat.size,
          });
        }
      }

      return nodes;
    };

    return walk(rootDir);
  }

  /**
   * Export artifact metadata from workspace paths
   */
  async exportArtifacts(sessionId: string, pathsToExport: string[]): Promise<SandboxArtifactInfo[]> {
    const containerInfo = this.containers.get(sessionId);
    if (!containerInfo) return [];

    const rootDir = containerInfo.workspaceDir;
    const results: SandboxArtifactInfo[] = [];

    for (const item of pathsToExport) {
      const resolved = path.resolve(rootDir, item);
      if (!resolved.startsWith(rootDir)) {
        continue;
      }
      try {
        const stat = await fs.promises.stat(resolved);
        if (!stat.isFile()) continue;
        results.push({
          path: path.relative(rootDir, resolved),
          size: stat.size,
          mimeType: this.getMimeType(resolved),
        });
      } catch {
        // Ignore missing files
      }
    }

    return results;
  }

  /**
   * Parse memory string to bytes
   */
  private parseMemory(memory: string): number {
    const match = memory.match(/^(\d+(?:\.\d+)?)\s*(KB|MB|GB|TB)?$/i);
    if (!match) return 512 * 1024 * 1024; // Default 512MB

    const value = parseFloat(match[1]);
    const unit = (match[2] || 'MB').toUpperCase();

    const multipliers: Record<string, number> = {
      KB: 1024,
      MB: 1024 * 1024,
      GB: 1024 * 1024 * 1024,
      TB: 1024 * 1024 * 1024 * 1024,
    };

    return Math.floor(value * (multipliers[unit] || multipliers.MB));
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.json': 'application/json',
      '.yaml': 'text/yaml',
      '.yml': 'text/yaml',
      '.js': 'application/javascript',
      '.ts': 'application/typescript',
      '.py': 'text/x-python',
      '.go': 'text/x-go',
      '.rs': 'text/x-rust',
      '.java': 'text/x-java',
      '.html': 'text/html',
      '.css': 'text/css',
      '.sql': 'application/sql',
      '.sh': 'application/x-sh',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.pdf': 'application/pdf',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Cleanup all sandboxes
   */
  async cleanup(): Promise<void> {
    const sessions = Array.from(this.containers.keys());
    await Promise.all(sessions.map((s) => this.destroySandbox(s)));
  }
}

// Singleton instance
let sandboxManager: SandboxManager | null = null;

/**
 * Get the sandbox manager instance
 */
export function getSandboxManager(): SandboxManager {
  if (!sandboxManager) {
    sandboxManager = new SandboxManager();
  }
  return sandboxManager;
}

/**
 * Clear sandbox manager (useful for testing)
 */
export function clearSandboxManager(): void {
  sandboxManager = null;
}

/**
 * Cleanup on process exit
 */
process.on('SIGTERM', async () => {
  if (sandboxManager) {
    await sandboxManager.cleanup();
  }
});

process.on('SIGINT', async () => {
  if (sandboxManager) {
    await sandboxManager.cleanup();
  }
});
