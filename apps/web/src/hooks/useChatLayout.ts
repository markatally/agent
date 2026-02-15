import { useSyncExternalStore } from 'react';

export type ChatLayoutMode = 'narrow' | 'normal' | 'wide';

const STORAGE_KEY = 'chat-layout-mode';
const DEFAULT_LAYOUT: ChatLayoutMode = 'wide';

const CHAT_LAYOUT_MAX_WIDTH: Record<ChatLayoutMode, string> = {
  narrow: '920px',
  normal: '1120px',
  wide: '1400px',
};

function isChatLayoutMode(value: string | null): value is ChatLayoutMode {
  return value === 'narrow' || value === 'normal' || value === 'wide';
}

function getStoredLayoutMode(): ChatLayoutMode {
  if (typeof window === 'undefined') return DEFAULT_LAYOUT;
  const stored = localStorage.getItem(STORAGE_KEY);
  return isChatLayoutMode(stored) ? stored : DEFAULT_LAYOUT;
}

function applyChatLayoutMode(mode: ChatLayoutMode) {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--chat-content-max-width', CHAT_LAYOUT_MAX_WIDTH[mode]);
}

let currentMode: ChatLayoutMode = getStoredLayoutMode();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): ChatLayoutMode {
  return currentMode;
}

function setMode(mode: ChatLayoutMode) {
  currentMode = mode;
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, mode);
  }
  applyChatLayoutMode(mode);
  listeners.forEach((listener) => listener());
}

if (typeof window !== 'undefined') {
  applyChatLayoutMode(currentMode);
}

export function useChatLayout() {
  const mode = useSyncExternalStore(subscribe, getSnapshot);

  return {
    mode,
    setMode,
    widths: CHAT_LAYOUT_MAX_WIDTH,
  };
}
