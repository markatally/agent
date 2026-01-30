import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import {
  hashPassword,
  verifyPassword,
  generateTokenPair,
  verifyToken,
} from '../services/auth';

const auth = new Hono();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

/**
 * POST /api/auth/register
 * Register a new user
 */
auth.post('/register', zValidator('json', registerSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return c.json(
      {
        error: {
          code: 'USER_EXISTS',
          message: 'User with this email already exists',
        },
      },
      409
    );
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
    },
    select: {
      id: true,
      email: true,
      createdAt: true,
    },
  });

  // Generate tokens
  const tokens = generateTokenPair(user.id, user.email);

  return c.json(
    {
      user,
      ...tokens,
    },
    201
  );
});

/**
 * POST /api/auth/login
 * Login with email and password
 */
auth.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  // Find user
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return c.json(
      {
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      },
      401
    );
  }

  // Verify password
  const isValid = await verifyPassword(password, user.passwordHash);

  if (!isValid) {
    return c.json(
      {
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      },
      401
    );
  }

  // Generate tokens
  const tokens = generateTokenPair(user.id, user.email);

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
    },
    ...tokens,
  });
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
auth.post('/refresh', zValidator('json', refreshSchema), async (c) => {
  const { refreshToken } = c.req.valid('json');

  try {
    // Verify refresh token
    const payload = verifyToken(refreshToken);

    if (payload.type !== 'refresh') {
      return c.json(
        {
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid token type',
          },
        },
        401
      );
    }

    // Verify user still exists
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      return c.json(
        {
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        },
        401
      );
    }

    // Generate new tokens
    const tokens = generateTokenPair(user.id, user.email);

    return c.json(tokens);
  } catch (error) {
    return c.json(
      {
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired refresh token',
        },
      },
      401
    );
  }
});

export { auth as authRoutes };
