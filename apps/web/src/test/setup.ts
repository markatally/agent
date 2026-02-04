import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock localStorage with in-memory backing store
const localStorageStore = new Map<string, string>();
const localStorageMock = {
  getItem: vi.fn((key: string) =>
    localStorageStore.has(key) ? localStorageStore.get(key)! : null
  ),
  setItem: vi.fn((key: string, value: string) => {
    localStorageStore.set(key, String(value));
  }),
  removeItem: vi.fn((key: string) => {
    localStorageStore.delete(key);
  }),
  clear: vi.fn(() => {
    localStorageStore.clear();
  }),
};

globalThis.localStorage = localStorageMock as any;
