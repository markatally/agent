import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { requireAuth, AuthContext } from '../middleware/auth';

const messages = new Hono<AuthContext>();

// All message routes require authentication
messages.use('*', requireAuth);

// Validation schema
const sendMessageSchema = z.object({
  content: z.string().min(1, 'Message content is required'),
});

/**
 * POST /api/sessions/:sessionId/messages
 * Send a message to a session
 */
messages.post(
  '/sessions/:sessionId/messages',
  zValidator('json', sendMessageSchema),
  async (c) => {
    const user = c.get('user');
    const sessionId = c.req.param('sessionId');
    const { content } = c.req.valid('json');

    // Verify session exists and belongs to user
    const session = await prisma.session.findUnique({
      where: {
        id: sessionId,
        userId: user.userId,
      },
    });

    if (!session) {
      return c.json(
        {
          error: {
            code: 'SESSION_NOT_FOUND',
            message: 'Session not found',
          },
        },
        404
      );
    }

    // Check if session is active
    if (session.status !== 'active') {
      return c.json(
        {
          error: {
            code: 'SESSION_NOT_ACTIVE',
            message: 'Cannot send messages to inactive session',
          },
        },
        400
      );
    }

    // Create user message
    const message = await prisma.message.create({
      data: {
        sessionId,
        role: 'user',
        content,
      },
    });

    // Update session's lastActiveAt timestamp
    await prisma.session.update({
      where: { id: sessionId },
      data: { lastActiveAt: new Date() },
    });

    // TODO: In Phase 3, trigger LLM processing here
    // For now, just return the created message

    return c.json(message, 201);
  }
);

/**
 * GET /api/sessions/:sessionId/messages
 * Get all messages for a session
 */
messages.get('/sessions/:sessionId/messages', async (c) => {
  const user = c.get('user');
  const sessionId = c.req.param('sessionId');

  // Verify session exists and belongs to user
  const session = await prisma.session.findUnique({
    where: {
      id: sessionId,
      userId: user.userId,
    },
  });

  if (!session) {
    return c.json(
      {
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found',
        },
      },
      404
    );
  }

  // Get all messages
  const sessionMessages = await prisma.message.findMany({
    where: {
      sessionId,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  return c.json({
    messages: sessionMessages,
  });
});

/**
 * GET /api/messages/:id
 * Get a specific message
 */
messages.get('/messages/:id', async (c) => {
  const user = c.get('user');
  const messageId = c.req.param('id');

  // Get message and verify session ownership
  const message = await prisma.message.findUnique({
    where: {
      id: messageId,
    },
    include: {
      session: {
        select: {
          userId: true,
        },
      },
    },
  });

  if (!message) {
    return c.json(
      {
        error: {
          code: 'MESSAGE_NOT_FOUND',
          message: 'Message not found',
        },
      },
      404
    );
  }

  // Verify user owns the session
  if (message.session.userId !== user.userId) {
    return c.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'You do not have access to this message',
        },
      },
      403
    );
  }

  // Remove session from response
  const { session: _, ...messageData } = message;

  return c.json(messageData);
});

export { messages as messageRoutes };
