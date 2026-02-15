import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('useChatLayout', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.removeProperty('--chat-content-max-width');
  });

  it('reads persisted mode and applies corresponding chat width', async () => {
    localStorage.setItem('chat-layout-mode', 'normal');
    vi.resetModules();

    const { useChatLayout } = await import('../useChatLayout');
    const { result } = renderHook(() => useChatLayout());

    expect(result.current.mode).toBe('normal');
    expect(document.documentElement.style.getPropertyValue('--chat-content-max-width')).toBe('1120px');
  });

  it('persists updates and applies width immediately', async () => {
    vi.resetModules();

    const { useChatLayout } = await import('../useChatLayout');
    const { result } = renderHook(() => useChatLayout());

    act(() => {
      result.current.setMode('narrow');
    });

    expect(result.current.mode).toBe('narrow');
    expect(localStorage.getItem('chat-layout-mode')).toBe('narrow');
    expect(document.documentElement.style.getPropertyValue('--chat-content-max-width')).toBe('920px');
  });
});
