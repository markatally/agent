import { describe, it, expect, beforeAll, beforeEach } from 'bun:test';
import type { BrowserAction } from '../../packages/shared/src';

let useChatStore: typeof import('../../apps/web/src/stores/chatStore').useChatStore;

const createAction = (overrides: Partial<BrowserAction> = {}): BrowserAction => ({
  id: overrides.id ?? `action-${Date.now()}`,
  type: overrides.type ?? 'navigate',
  url: overrides.url,
  selector: overrides.selector,
  text: overrides.text,
  timestamp: overrides.timestamp ?? Date.now(),
  frameIndex: overrides.frameIndex,
  screenshotDataUrl: overrides.screenshotDataUrl,
});

describe('Computer mode browser timeline', () => {
  beforeAll(async () => {
    if (!globalThis.localStorage) {
      globalThis.localStorage = {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
        clear: () => undefined,
        key: () => null,
        length: 0,
      };
    }
    const mod = await import('../../apps/web/src/stores/chatStore');
    useChatStore = mod.useChatStore;
  });

  beforeEach(() => {
    useChatStore.getState().clearBrowserSession('session-1');
    useChatStore.getState().clearBrowserSession('session-2');
  });

  it('should attach screenshots to each browser action in order', () => {
    const sessionId = 'session-1';
    const { addBrowserAction, setBrowserActionScreenshot } = useChatStore.getState();

    addBrowserAction(sessionId, createAction({ id: 'a1', type: 'navigate', url: 'https://example.com', timestamp: 1 }));
    setBrowserActionScreenshot(sessionId, 'data:image/jpeg;base64,one');

    addBrowserAction(sessionId, createAction({ id: 'a2', type: 'click', selector: '#submit', timestamp: 2 }));
    setBrowserActionScreenshot(sessionId, 'data:image/jpeg;base64,two');

    const actions = useChatStore.getState().browserSession.get(sessionId)?.actions ?? [];
    expect(actions).toHaveLength(2);
    expect(actions[0].screenshotDataUrl).toBe('data:image/jpeg;base64,one');
    expect(actions[1].screenshotDataUrl).toBe('data:image/jpeg;base64,two');
  });

  it('should ignore screenshot updates when no action exists', () => {
    const sessionId = 'session-2';
    useChatStore.getState().setBrowserActionScreenshot(sessionId, 'data:image/png;base64,noop');

    const session = useChatStore.getState().browserSession.get(sessionId);
    expect(session).toBeUndefined();
  });
});
