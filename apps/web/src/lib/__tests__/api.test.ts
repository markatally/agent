/**
 * API Client Tests
 * 
 * Tests for token management, auth flow, and error handling
 * CRITICAL: Tests to prevent the async/await bug from screenshots
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  setTokens,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  ApiError,
} from '../api';

// Mock the auth store
vi.mock('../../stores/authStore', () => ({
  useAuthStore: {
    getState: () => ({
      setIsAuthenticated: vi.fn(),
      setUser: vi.fn(),
    }),
  },
}));

describe('API Client', () => {
  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();
    // Reset tokens
    clearTokens();
    // Clear fetch mock
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Token Management', () => {
    describe('getAccessToken', () => {
      it('CRITICAL: should be synchronous (not async)', () => {
        // This test prevents the bug from the screenshot where getAccessToken was awaited
        setTokens('test-token', 'test-refresh');
        
        const result = getAccessToken();
        
        // Should return immediately without Promise
        expect(result).not.toBeInstanceOf(Promise);
        expect(typeof result).toBe('string');
        expect(result).toBe('test-token');
      });

      it('should return null when no token set', () => {
        const token = getAccessToken();
        expect(token).toBeNull();
      });

      it('should retrieve token from localStorage if not in memory', () => {
        localStorage.setItem('accessToken', 'stored-token');
        
        const token = getAccessToken();
        expect(token).toBe('stored-token');
      });
    });

    describe('getRefreshToken', () => {
      it('CRITICAL: should be synchronous (not async)', () => {
        setTokens('access', 'refresh');
        
        const result = getRefreshToken();
        
        expect(result).not.toBeInstanceOf(Promise);
        expect(typeof result).toBe('string');
      });

      it('should return null when no token set', () => {
        const token = getRefreshToken();
        expect(token).toBeNull();
      });

      it('should retrieve token from localStorage', () => {
        localStorage.setItem('refreshToken', 'stored-refresh');
        
        const token = getRefreshToken();
        expect(token).toBe('stored-refresh');
      });
    });

    describe('setTokens', () => {
      it('should store tokens in memory and localStorage', () => {
        setTokens('new-access', 'new-refresh');
        
        expect(getAccessToken()).toBe('new-access');
        expect(getRefreshToken()).toBe('new-refresh');
        expect(localStorage.getItem('accessToken')).toBe('new-access');
        expect(localStorage.getItem('refreshToken')).toBe('new-refresh');
      });
    });

    describe('clearTokens', () => {
      it('should remove tokens from memory and localStorage', () => {
        setTokens('access', 'refresh');
        clearTokens();
        
        expect(getAccessToken()).toBeNull();
        expect(getRefreshToken()).toBeNull();
        expect(localStorage.getItem('accessToken')).toBeNull();
        expect(localStorage.getItem('refreshToken')).toBeNull();
      });
    });
  });

  describe('ApiError', () => {
    it('should create error with status and code', () => {
      const error = new ApiError('Test error', 404, 'NOT_FOUND');
      
      expect(error.message).toBe('Test error');
      expect(error.status).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.name).toBe('ApiError');
    });
  });

  describe('API Fetch with Auth', () => {
    it('should include Authorization header when token exists', async () => {
      setTokens('test-token', 'test-refresh');
      
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: 'test' }),
      });

      // Import apiClient dynamically to test with tokens set
      const { apiClient } = await import('../api');
      await apiClient.sessions.list();

      const fetchCall = (global.fetch as any).mock.calls[0];
      const headers = fetchCall[1].headers;
      
      expect(headers['Authorization']).toBe('Bearer test-token');
    });

    it('should not include Authorization header when no token', async () => {
      clearTokens();
      
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: 'test' }),
      });

      const { apiClient } = await import('../api');
      
      try {
        await apiClient.auth.login('test@test.com', 'password');
      } catch {
        // May fail, we just want to check headers
      }

      const fetchCall = (global.fetch as any).mock.calls[0];
      const headers = fetchCall[1].headers;
      
      expect(headers['Authorization']).toBeUndefined();
    });
  });

  describe('Token Refresh Flow', () => {
    it('should refresh token on 401 and retry request', async () => {
      setTokens('expired-token', 'valid-refresh');
      
      // First call returns 401
      // Second call (refresh) returns new tokens
      // Third call (retry) succeeds
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({ error: 'Unauthorized' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            accessToken: 'new-access',
            refreshToken: 'new-refresh',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: 'success' }),
        });

      const { apiClient } = await import('../api');
      const result = await apiClient.sessions.list();

      // Should have made 3 calls: original, refresh, retry
      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(result).toEqual({ data: 'success' });
      
      // Tokens should be updated
      expect(getAccessToken()).toBe('new-access');
      expect(getRefreshToken()).toBe('new-refresh');
    });

    it('should clear tokens when refresh fails', async () => {
      setTokens('expired-token', 'invalid-refresh');
      
      // First call returns 401
      // Refresh fails
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
        });

      const { apiClient } = await import('../api');
      
      await expect(apiClient.sessions.list()).rejects.toThrow('Session expired');
      
      // Tokens should be cleared
      expect(getAccessToken()).toBeNull();
      expect(getRefreshToken()).toBeNull();
    });

    it('should not attempt refresh for /auth/refresh endpoint', async () => {
      setTokens('token', 'refresh');
      
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 401,
      });

      const { apiClient } = await import('../api');
      
      await expect(apiClient.auth.refresh('refresh')).rejects.toThrow();
      
      // Should only call fetch once (no retry)
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should throw ApiError on HTTP errors', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({}),
      });

      const { apiClient } = await import('../api');
      
      await expect(apiClient.sessions.list()).rejects.toThrow(ApiError);
    });

    it('should extract error message from response', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({
          error: {
            message: 'Validation failed',
            code: 'VALIDATION_ERROR',
          },
        }),
      });

      const { apiClient } = await import('../api');
      
      try {
        await apiClient.sessions.list();
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).message).toBe('Validation failed');
        expect((error as ApiError).code).toBe('VALIDATION_ERROR');
      }
    });

    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const { apiClient } = await import('../api');
      
      await expect(apiClient.sessions.list()).rejects.toThrow('Network error');
    });
  });

  describe('Specific API Methods', () => {
    beforeEach(() => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });
    });

    describe('Auth API', () => {
      it('should call login endpoint', async () => {
        const { apiClient } = await import('../api');
        await apiClient.auth.login('test@test.com', 'password');

        const fetchCall = (global.fetch as any).mock.calls[0];
        expect(fetchCall[0]).toContain('/auth/login');
        expect(fetchCall[1].method).toBe('POST');
      });

      it('should call register endpoint', async () => {
        const { apiClient } = await import('../api');
        await apiClient.auth.register('test@test.com', 'password');

        const fetchCall = (global.fetch as any).mock.calls[0];
        expect(fetchCall[0]).toContain('/auth/register');
      });
    });

    describe('Sessions API', () => {
      it('should call sessions list endpoint', async () => {
        const { apiClient } = await import('../api');
        await apiClient.sessions.list();

        const fetchCall = (global.fetch as any).mock.calls[0];
        expect(fetchCall[0]).toContain('/sessions');
        expect(fetchCall[1].method).toBeUndefined(); // GET is default
      });

      it('should call create session endpoint', async () => {
        const { apiClient } = await import('../api');
        await apiClient.sessions.create('Test Session');

        const fetchCall = (global.fetch as any).mock.calls[0];
        expect(fetchCall[0]).toContain('/sessions');
        expect(fetchCall[1].method).toBe('POST');
      });
    });
  });

  describe('Chat Streaming', () => {
    it('should stop reading stream after terminal event and ignore trailing events', async () => {
      const reader = {
        cancel: vi.fn().mockResolvedValue(undefined),
        releaseLock: vi.fn(),
        read: vi
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(
              [
                'data: {"type":"message.start","sessionId":"session-1","timestamp":1,"data":{}}',
                'data: {"type":"message.complete","sessionId":"session-1","timestamp":2,"data":{"assistantMessageId":"a-1"}}',
                '',
              ].join('\n')
            ),
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(
              [
                'data: {"type":"message.start","sessionId":"session-1","timestamp":3,"data":{}}',
                '',
              ].join('\n')
            ),
          })
          .mockResolvedValueOnce({ done: true, value: undefined }),
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        body: {
          getReader: () => reader,
        },
      });

      const { apiClient } = await import('../api');
      const events: Array<{ type: string }> = [];

      for await (const event of apiClient.chat.sendAndStream('session-1', 'hello')) {
        events.push({ type: event.type });
      }

      expect(events.map((event) => event.type)).toEqual([
        'message.start',
        'message.complete',
      ]);
      expect(reader.read).toHaveBeenCalledTimes(1);
      expect(reader.cancel).toHaveBeenCalledTimes(1);
      expect(reader.releaseLock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Type Safety', () => {
    it('should return data directly (not response.data)', async () => {
      // This tests the API contract bug pattern from screenshot
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => [{ id: '1', name: 'Session 1' }], // API returns array directly
      });

      const { apiClient } = await import('../api');
      const result = await apiClient.sessions.list();

      // Should be array directly, not { data: [...] }
      expect(Array.isArray(result)).toBe(true);
      expect(result[0].id).toBe('1');
    });
  });
});
