import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  generateState,
  getGoogleAuthorizationUrl,
  exchangeGoogleCode,
  findOrCreateGoogleUser,
  completeGoogleLogin,
} from '../../apps/api/src/services/oauth';
import { prisma } from '../../apps/api/src/services/prisma';

describe('OAuth Service', () => {
  beforeAll(async () => {
    // Test setup
  });

  afterAll(async () => {
    // Test cleanup
    await prisma.$disconnect();
  });

  describe('generateState', () => {
    it('should generate a random state string', () => {
      const state = generateState();
      expect(state).toBeDefined();
      expect(state).toHaveLength(32); // 16 bytes = 32 hex chars
    });

    it('should generate different states each time', () => {
      const state1 = generateState();
      const state2 = generateState();
      expect(state1).not.toBe(state2);
    });
  });

  describe('getGoogleAuthorizationUrl', () => {
    it('should return URL object when configured', () => {
      const result = getGoogleAuthorizationUrl();
      if (result === null) {
        // OAuth not configured - this is acceptable
        return;
      }
      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('state');
      expect(result.state).toBeDefined();
      expect(result.state).toHaveLength(32); // 16 bytes = 32 hex chars
      expect(result.url).toContain('accounts.google.com');
    });
  });

  describe('findOrCreateGoogleUser', () => {
    const testEmail = `test-${Date.now()}@example.com`;
    const testGoogleId = `google-${Date.now()}`;

    it('should create a new user when not found', async () => {
      const googleUser = {
        id: testGoogleId,
        email: testEmail,
        displayName: 'Test User',
      };

      const user = await findOrCreateGoogleUser(googleUser);

      expect(user).toBeDefined();
      expect(user.email).toBe(testEmail);
      expect(user.googleId).toBe(testGoogleId);
      expect(user.displayName).toBe('Test User');

      // Clean up
      await prisma.user.delete({ where: { id: user.id } });
    });

    it('should find existing user by email', async () => {
      const googleUser = {
        id: testGoogleId,
        email: testEmail,
        displayName: 'Test User',
      };

      // Create user first
      await prisma.user.create({
        data: {
          email: testEmail,
          displayName: 'Existing User',
        },
      });

      const user = await findOrCreateGoogleUser(googleUser);

      expect(user).toBeDefined();
      expect(user.email).toBe(testEmail);
      expect(user.googleId).toBe(testGoogleId); // Should be linked

      // Clean up
      await prisma.user.delete({ where: { id: user.id } });
    });

    it('should find existing user by googleId', async () => {
      const googleUser = {
        id: testGoogleId,
        email: testEmail,
        displayName: 'Test User',
      };

      // Create user first with googleId
      await prisma.user.create({
        data: {
          email: testEmail,
          googleId: testGoogleId,
          displayName: 'Existing User',
        },
      });

      const user = await findOrCreateGoogleUser(googleUser);

      expect(user).toBeDefined();
      expect(user.email).toBe(testEmail);
      expect(user.googleId).toBe(testGoogleId);

      // Clean up
      await prisma.user.delete({ where: { id: user.id } });
    });
  });

  describe('completeGoogleLogin', () => {
    const testEmail = `login-test-${Date.now()}@example.com`;
    const testGoogleId = `google-login-${Date.now()}`;

    it('should complete login and return tokens', async () => {
      const googleUser = {
        id: testGoogleId,
        email: testEmail,
        displayName: 'Login Test User',
      };

      const result = await completeGoogleLogin(googleUser);

      expect(result).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(testEmail);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();

      // Clean up
      await prisma.user.delete({ where: { id: result.user.id } });
    });
  });

  describe('exchangeGoogleCode', () => {
    it('should throw error on invalid code or state', async () => {
      // Since OAuth is configured in test environment,
      // we verify the function handles invalid inputs properly
      const state = generateState();
      await expect(exchangeGoogleCode('invalid_code', state)).rejects.toThrow();
    });
  });
});
