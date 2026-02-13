import type { AgentStep } from '../../types';

function getSnapshotDescription(step: AgentStep): string {
  return step.snapshot?.metadata?.actionDescription ?? '';
}

function isVisitStep(step: AgentStep): boolean {
  if (step.type !== 'browse') return false;
  const description = getSnapshotDescription(step);
  return description === 'Visit page' || description === 'Read page';
}

function isBrowserActionStep(step: AgentStep): boolean {
  if (step.type !== 'browse') return false;
  const description = getSnapshotDescription(step);
  return description.startsWith('Browser action:');
}

function getScopedSteps(
  steps: AgentStep[],
  matcher: (step: AgentStep) => boolean,
  runStartIndex?: number
): AgentStep[] {
  if (
    typeof runStartIndex === 'number' &&
    Number.isInteger(runStartIndex) &&
    runStartIndex >= 0 &&
    runStartIndex <= steps.length
  ) {
    const currentRun = steps.slice(runStartIndex).filter(matcher);
    if (currentRun.length > 0) return currentRun;
  }

  const inFlight = steps.filter((step) => !step.messageId && matcher(step));
  if (inFlight.length > 0) return inFlight;
  return steps.filter(matcher);
}

export function getVisitStepByIndex(
  steps: AgentStep[],
  visitIndex: number,
  runStartIndex?: number
): AgentStep | undefined {
  if (!Number.isInteger(visitIndex) || visitIndex < 0) return undefined;
  const candidates = getScopedSteps(steps, isVisitStep, runStartIndex);
  return candidates[visitIndex];
}

export function getBrowserActionStepByIndex(
  steps: AgentStep[],
  actionIndex?: number,
  runStartIndex?: number
): AgentStep | undefined {
  const candidates = getScopedSteps(steps, isBrowserActionStep, runStartIndex);
  if (candidates.length === 0) return undefined;

  if (
    typeof actionIndex === 'number' &&
    Number.isInteger(actionIndex) &&
    actionIndex >= 0 &&
    actionIndex < candidates.length
  ) {
    return candidates[actionIndex];
  }

  return candidates[candidates.length - 1];
}
