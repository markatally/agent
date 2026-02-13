import { describe, expect, it } from 'vitest';
import type { AgentStep } from '../../../types';
import { getBrowserActionStepByIndex, getVisitStepByIndex } from '../snapshotMapping';

function makeStep(
  stepIndex: number,
  description: string,
  messageId?: string
): AgentStep {
  return {
    stepIndex,
    type: 'browse',
    messageId,
    snapshot: {
      stepIndex,
      timestamp: Date.now() + stepIndex,
      metadata: {
        actionDescription: description,
      },
    },
  };
}

describe('snapshotMapping', () => {
  it('prefers in-flight visit steps when resolving visit screenshot index', () => {
    const steps: AgentStep[] = [
      makeStep(0, 'Visit page', 'msg-old'),
      makeStep(1, 'Visit page', 'msg-old'),
      makeStep(2, 'Visit page'),
      makeStep(3, 'Visit page'),
    ];

    const target = getVisitStepByIndex(steps, 1);
    expect(target?.stepIndex).toBe(3);
  });

  it('falls back to full history when no in-flight visit step exists', () => {
    const steps: AgentStep[] = [
      makeStep(0, 'Visit page', 'msg-old'),
      makeStep(1, 'Visit page', 'msg-old'),
    ];

    const target = getVisitStepByIndex(steps, 1);
    expect(target?.stepIndex).toBe(1);
  });

  it('prefers in-flight browser action steps when resolving browser screenshot index', () => {
    const steps: AgentStep[] = [
      makeStep(0, 'Browser action: navigate', 'msg-old'),
      makeStep(1, 'Browser action: click', 'msg-old'),
      makeStep(2, 'Browser action: navigate'),
      makeStep(3, 'Browser action: click'),
    ];

    const target = getBrowserActionStepByIndex(steps, 0);
    expect(target?.stepIndex).toBe(2);
  });

  it('returns last in-scope browser action step when action index is not provided', () => {
    const steps: AgentStep[] = [
      makeStep(0, 'Browser action: navigate', 'msg-old'),
      makeStep(1, 'Browser action: click'),
      makeStep(2, 'Browser action: type'),
    ];

    const target = getBrowserActionStepByIndex(steps);
    expect(target?.stepIndex).toBe(2);
  });

  it('uses run start index to avoid mapping screenshots to previous runs', () => {
    const steps: AgentStep[] = [
      makeStep(0, 'Visit page'),
      makeStep(1, 'Visit page'),
      makeStep(2, 'Visit page'),
      makeStep(3, 'Visit page'),
    ];

    const target = getVisitStepByIndex(steps, 0, 3);
    expect(target?.stepIndex).toBe(3);
  });
});
