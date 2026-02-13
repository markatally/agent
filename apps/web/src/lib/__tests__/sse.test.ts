import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { SSEClient } from '../sse';

type EventSourceHandler = ((event: any) => void) | null;

class MockEventSource {
  static instances: MockEventSource[] = [];
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;

  readyState = MockEventSource.OPEN;
  onopen: EventSourceHandler = null;
  onmessage: EventSourceHandler = null;
  onerror: EventSourceHandler = null;

  constructor(public url: string) {
    MockEventSource.instances.push(this);
  }

  close() {
    this.readyState = MockEventSource.CLOSED;
  }
}

describe('SSEClient', () => {
  const originalEventSource = globalThis.EventSource;

  beforeEach(() => {
    MockEventSource.instances = [];
    Object.defineProperty(globalThis, 'EventSource', {
      configurable: true,
      writable: true,
      value: MockEventSource as any,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'EventSource', {
      configurable: true,
      writable: true,
      value: originalEventSource,
    });
  });

  it('ignores late error events after close', () => {
    const onError = vi.fn();
    const client = new SSEClient();

    client.connect('/stream', {
      onEvent: vi.fn(),
      onError,
      reconnect: false,
    });

    const instance = MockEventSource.instances[0];
    expect(instance).toBeDefined();

    client.close();
    instance.onerror?.(new Event('error'));

    expect(onError).not.toHaveBeenCalled();
  });
});
