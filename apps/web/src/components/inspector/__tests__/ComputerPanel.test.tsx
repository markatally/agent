import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useChatStore } from '../../../stores/chatStore';
import { ComputerPanel } from '../ComputerPanel';

vi.mock('../../../hooks/useBrowserStream', () => ({
  useBrowserStream: () => ({
    frameDataUrl: null,
    status: 'idle',
    error: null,
  }),
}));

describe('ComputerPanel', () => {
  beforeEach(() => {
    useChatStore.setState({
      isStreaming: false,
      streamingSessionId: null,
      terminalLines: new Map(),
      executionSteps: new Map(),
      sandboxFiles: new Map(),
      sandboxStatus: 'idle',
      pptPipeline: new Map(),
      isPptTask: new Map(),
      files: new Map(),
      browserSession: new Map(),
      agentSteps: new Map(),
    });
  });

  it('renders neutral empty state when no computer activity exists', () => {
    render(<ComputerPanel sessionId="session-empty" compact />);

    expect(screen.getByTestId('computer-empty-state')).toBeInTheDocument();
    expect(screen.queryByText('Browser view is off')).not.toBeInTheDocument();
  });

  it('shows replay placeholder (not browser-off) for historical timeline steps without snapshots', () => {
    useChatStore.setState({
      browserSession: new Map([
        [
          'session-history',
          {
            active: false,
            currentUrl: 'https://example.com',
            currentTitle: 'Example',
            status: 'closed',
            actions: [],
            currentActionIndex: 0,
          },
        ],
      ]),
      agentSteps: new Map([
        [
          'session-history',
          {
            currentStepIndex: 0,
            steps: [
              {
                stepIndex: 0,
                type: 'browse',
                output: 'Visit page',
                snapshot: {
                  stepIndex: 0,
                  timestamp: Date.now(),
                  url: 'https://example.com',
                  metadata: {
                    actionDescription: 'Visit page',
                  },
                },
              },
            ],
          },
        ],
      ]),
    });

    render(<ComputerPanel sessionId="session-history" compact />);

    expect(screen.getByText(/Snapshot unavailable for this step/i)).toBeInTheDocument();
    expect(screen.queryByText('Browser view is off')).not.toBeInTheDocument();
  });
});
