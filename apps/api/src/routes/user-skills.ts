/**
 * User Skills API Routes
 * Endpoints for managing per-user skill preferences
 */

import { Hono } from 'hono';
import { requireAuth, AuthContext } from '../middleware/auth';
import { getExternalSkillLoader } from '../services/external-skills/loader';
import { prisma } from '../services/prisma';
import { z } from 'zod';

const app = new Hono<AuthContext>();

// All user-skills routes require authentication
app.use('*', requireAuth);

// Validation schemas
const UpdateUserSkillsSchema = z.object({
  skills: z.array(
    z.object({
      canonicalId: z.string().min(1),
      enabled: z.boolean(),
    })
  ),
});

const ToggleSkillSchema = z.object({
  enabled: z.boolean(),
});

/**
 * GET /api/user-skills
 * Get current user's skills with enabled state
 * Used by: UI (SkillsConfigModal)
 */
app.get('/', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userId = user.userId;

    // Query user's skill preferences
    const userSkills = await prisma.userExternalSkill.findMany({
      where: { userId },
      include: {
        skill: true, // Include skill metadata
      },
      orderBy: {
        enabledAt: 'asc', // Deterministic ordering
      },
    });

    // Map to response format
    const skills = userSkills.map((us) => ({
      canonicalId: us.canonicalId,
      name: us.skill.name,
      description: us.skill.description,
      category: us.skill.category,
      enabled: us.enabled,
      addedAt: us.createdAt.toISOString(),
      updatedAt: us.updatedAt.toISOString(),
    }));

    return c.json({
      skills,
      total: skills.length,
    });
  } catch (error) {
    console.error('Error listing user skills:', error);
    return c.json(
      {
        error: 'Failed to list user skills',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * PUT /api/user-skills
 * Bulk update user's skill preferences (add/remove/toggle)
 * Used by: UI (SkillsConfigModal - single save operation)
 */
app.put('/', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userId = user.userId;
    const body = await c.req.json();
    const validated = UpdateUserSkillsSchema.parse(body);

    const loader = getExternalSkillLoader();

    // Process bulk update in transaction
    await prisma.$transaction(async (tx) => {
      // Get current user skills
      const currentSkills = await tx.userExternalSkill.findMany({
        where: { userId },
        select: { canonicalId: true },
      });

      const currentCanonicalIds = new Set(
        currentSkills.map((s) => s.canonicalId)
      );
      const requestedCanonicalIds = new Set(
        validated.skills.map((s) => s.canonicalId)
      );

      // Skills to remove (in current but not in request)
      const toRemove = Array.from(currentCanonicalIds).filter(
        (id) => !requestedCanonicalIds.has(id)
      );

      // Skills to add/update (in request)
      const toUpsert = validated.skills;

      // Remove skills no longer in user's set
      if (toRemove.length > 0) {
        await tx.userExternalSkill.deleteMany({
          where: {
            userId,
            canonicalId: { in: toRemove },
          },
        });
      }

      // Upsert requested skills
      for (const skillUpdate of toUpsert) {
        // Verify skill exists in registry
        const skill = await loader.getSkill(skillUpdate.canonicalId);
        if (!skill) {
          console.warn(
            `Skill ${skillUpdate.canonicalId} not found in registry, skipping`
          );
          continue;
        }

        await tx.userExternalSkill.upsert({
          where: {
            userId_canonicalId: {
              userId,
              canonicalId: skillUpdate.canonicalId,
            },
          },
          create: {
            userId,
            canonicalId: skillUpdate.canonicalId,
            enabled: skillUpdate.enabled,
            enabledAt: skillUpdate.enabled ? new Date() : undefined,
            disabledAt: !skillUpdate.enabled ? new Date() : undefined,
          },
          update: {
            enabled: skillUpdate.enabled,
            enabledAt: skillUpdate.enabled ? new Date() : undefined,
            disabledAt: !skillUpdate.enabled ? new Date() : undefined,
          },
        });
      }
    });

    // Fetch updated skills
    const updatedSkills = await prisma.userExternalSkill.findMany({
      where: { userId },
      include: {
        skill: true,
      },
      orderBy: {
        enabledAt: 'asc',
      },
    });

    const skills = updatedSkills.map((us) => ({
      canonicalId: us.canonicalId,
      name: us.skill.name,
      description: us.skill.description,
      category: us.skill.category,
      enabled: us.enabled,
      addedAt: us.createdAt.toISOString(),
      updatedAt: us.updatedAt.toISOString(),
    }));

    return c.json({
      success: true,
      skills,
      total: skills.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request body', details: error.errors }, 400);
    }

    console.error('Error updating user skills:', error);
    return c.json(
      {
        error: 'Failed to update user skills',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * POST /api/user-skills/:canonicalId
 * Add skill to user's set
 * Used by: Internal APIs (not UI)
 */
app.post('/:canonicalId', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userId = user.userId;
    const canonicalId = c.req.param('canonicalId');

    const loader = getExternalSkillLoader();
    const skill = await loader.getSkill(canonicalId);

    if (!skill) {
      return c.json({ error: 'Skill not found in registry' }, 404);
    }

    const userSkill = await prisma.userExternalSkill.upsert({
      where: {
        userId_canonicalId: {
          userId,
          canonicalId,
        },
      },
      create: {
        userId,
        canonicalId,
        enabled: true,
        enabledAt: new Date(),
      },
      update: {
        enabled: true,
        enabledAt: new Date(),
        disabledAt: null,
      },
      include: {
        skill: true,
      },
    });

    return c.json({
      success: true,
      skill: {
        canonicalId: userSkill.canonicalId,
        name: userSkill.skill.name,
        description: userSkill.skill.description,
        category: userSkill.skill.category,
        enabled: userSkill.enabled,
        addedAt: userSkill.createdAt.toISOString(),
        updatedAt: userSkill.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error adding user skill:', error);
    return c.json(
      {
        error: 'Failed to add user skill',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * DELETE /api/user-skills/:canonicalId
 * Remove skill from user's set
 * Used by: Internal APIs (not UI)
 */
app.delete('/:canonicalId', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userId = user.userId;
    const canonicalId = c.req.param('canonicalId');

    await prisma.userExternalSkill.delete({
      where: {
        userId_canonicalId: {
          userId,
          canonicalId,
        },
      },
    });

    return c.json({
      success: true,
      message: `Skill ${canonicalId} removed from user's set`,
    });
  } catch (error) {
    if ((error as any).code === 'P2025') {
      // Record not found
      return c.json({ error: 'Skill not in user\'s set' }, 404);
    }

    console.error('Error removing user skill:', error);
    return c.json(
      {
        error: 'Failed to remove user skill',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * PATCH /api/user-skills/:canonicalId
 * Toggle enabled state
 * Used by: Internal APIs (not UI)
 */
app.patch('/:canonicalId', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userId = user.userId;
    const canonicalId = c.req.param('canonicalId');
    const body = await c.req.json();
    const validated = ToggleSkillSchema.parse(body);

    const userSkill = await prisma.userExternalSkill.update({
      where: {
        userId_canonicalId: {
          userId,
          canonicalId,
        },
      },
      data: {
        enabled: validated.enabled,
        enabledAt: validated.enabled ? new Date() : undefined,
        disabledAt: !validated.enabled ? new Date() : undefined,
      },
      include: {
        skill: true,
      },
    });

    return c.json({
      success: true,
      skill: {
        canonicalId: userSkill.canonicalId,
        name: userSkill.skill.name,
        description: userSkill.skill.description,
        category: userSkill.skill.category,
        enabled: userSkill.enabled,
        addedAt: userSkill.createdAt.toISOString(),
        updatedAt: userSkill.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request body', details: error.errors }, 400);
    }

    if ((error as any).code === 'P2025') {
      return c.json({ error: 'Skill not in user\'s set' }, 404);
    }

    console.error('Error toggling user skill:', error);
    return c.json(
      {
        error: 'Failed to toggle user skill',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

export const userSkillRoutes = app;
export default app;
