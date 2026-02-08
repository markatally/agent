/**
 * Frame Buffer Service
 * Stores last N screencast frames per session for timeline scrubbing and broadcasts to WebSocket clients.
 */

const DEFAULT_MAX_FRAMES = 100;

export interface FrameEntry {
  index: number;
  data: Buffer;
  metadata?: { sessionId?: number; pageScaleFactor?: number; offsetTop?: number; offsetLeft?: number };
}

type WebSocketLike = { send(data: string | Buffer | ArrayBuffer): void; readyState: number };

const WS_OPEN = 1;

export class FrameBufferService {
  private frames: Map<string, FrameEntry[]> = new Map();
  private clients: Map<string, Set<WebSocketLike>> = new Map();
  private frameIndex: Map<string, number> = new Map();
  private maxFrames: number;

  constructor(maxFrames = DEFAULT_MAX_FRAMES) {
    this.maxFrames = maxFrames;
  }

  subscribe(sessionId: string, ws: WebSocketLike): void {
    if (!this.clients.has(sessionId)) {
      this.clients.set(sessionId, new Set());
    }
    this.clients.get(sessionId)!.add(ws);
  }

  unsubscribe(sessionId: string, ws: WebSocketLike): void {
    const set = this.clients.get(sessionId);
    if (set) {
      set.delete(ws);
      if (set.size === 0) {
        this.clients.delete(sessionId);
      }
    }
  }

  push(sessionId: string, data: Buffer, metadata?: FrameEntry['metadata']): void {
    const index = (this.frameIndex.get(sessionId) ?? 0) + 1;
    this.frameIndex.set(sessionId, index);

    const entry: FrameEntry = { index, data, metadata };
    let list = this.frames.get(sessionId);
    if (!list) {
      list = [];
      this.frames.set(sessionId, list);
    }
    list.push(entry);
    if (list.length > this.maxFrames) {
      list.shift();
    }

    const clients = this.clients.get(sessionId);
    if (clients) {
      for (const ws of clients) {
        if (ws.readyState === WS_OPEN) {
          try {
            ws.send(data);
          } catch (_) {
            // ignore
          }
        }
      }
    }
  }

  getFrame(sessionId: string, index: number): Buffer | undefined {
    const list = this.frames.get(sessionId);
    if (!list) return undefined;
    const entry = list.find((e) => e.index === index);
    return entry?.data;
  }

  getFrameCount(sessionId: string): number {
    return this.frames.get(sessionId)?.length ?? 0;
  }

  getLastFrameIndex(sessionId: string): number {
    return this.frameIndex.get(sessionId) ?? 0;
  }

  clear(sessionId: string): void {
    this.frames.delete(sessionId);
    this.frameIndex.delete(sessionId);
    this.clients.delete(sessionId);
  }
}

let frameBufferInstance: FrameBufferService | null = null;

export function getFrameBufferService(): FrameBufferService {
  if (!frameBufferInstance) {
    frameBufferInstance = new FrameBufferService();
  }
  return frameBufferInstance;
}
