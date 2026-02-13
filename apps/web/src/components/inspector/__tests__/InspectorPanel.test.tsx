import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useChatStore } from '../../../stores/chatStore';
import { InspectorPanel } from '../InspectorPanel';

vi.mock('../../../hooks/useBrowserStream', () => ({
  useBrowserStream: () => ({
    frameDataUrl: null,
    status: 'idle',
    error: null,
  }),
}));

describe('InspectorPanel structure', () => {
  beforeEach(() => {
    useChatStore.setState({
      selectedMessageId: null,
      isStreaming: false,
      streamingSessionId: null,
      reasoningSteps: new Map(),
      messages: new Map(),
      toolCalls: new Map(),
      browserSession: new Map(),
      executionSteps: new Map(),
    });
  });

  it('renders a single Computer and a single Reasoning Trace section without standalone tool blocks', () => {
    render(<InspectorPanel open sessionId="session-1" />);

    expect(screen.getAllByText('Computer')).toHaveLength(1);
    expect(screen.getAllByText('Reasoning Trace')).toHaveLength(1);
    expect(screen.queryByText('Other Tools')).not.toBeInTheDocument();
    expect(screen.getByTestId('computer-empty-state')).toBeInTheDocument();
    expect(screen.queryByText('Browser view is off')).not.toBeInTheDocument();
  });

  it('shows Live status when computer is actively running', () => {
    useChatStore.setState({
      isStreaming: true,
      streamingSessionId: 'session-1',
      browserSession: new Map([
        [
          'session-1',
          {
            active: true,
            currentUrl: 'https://example.com',
            currentTitle: 'Example',
            status: 'active',
            actions: [],
            currentActionIndex: 0,
          },
        ],
      ]),
    });

    render(<InspectorPanel open sessionId="session-1" />);

    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.queryByText('Running')).not.toBeInTheDocument();
  });

  it('shows immediate live inspector state before any tool activity', () => {
    useChatStore.setState({
      isStreaming: true,
      streamingSessionId: 'session-1',
      browserSession: new Map(),
      reasoningSteps: new Map(),
      toolCalls: new Map(),
      messages: new Map(),
    });

    render(<InspectorPanel open sessionId="session-1" />);

    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getByText('thinking...')).toBeInTheDocument();
    expect(screen.getByTestId('computer-empty-state')).toBeInTheDocument();
  });

  it('shows Idle status before any computer activity', () => {
    render(<InspectorPanel open sessionId="session-1" />);

    expect(screen.queryByText('Live')).not.toBeInTheDocument();
    expect(screen.getByText('Idle')).toBeInTheDocument();
  });

  it('shows Completed status after computer activity ends', () => {
    useChatStore.setState({
      isStreaming: false,
      streamingSessionId: null,
      browserSession: new Map([
        [
          'session-1',
          {
            active: true,
            currentUrl: 'https://example.com',
            currentTitle: 'Example',
            status: 'active',
            actions: [],
            currentActionIndex: 0,
          },
        ],
      ]),
    });

    render(<InspectorPanel open sessionId="session-1" />);

    expect(screen.queryByText('Live')).not.toBeInTheDocument();
    expect(screen.getAllByText('Completed').length).toBeGreaterThan(0);
  });

  it('collapses Computer with no reserved space after animation', () => {
    vi.useFakeTimers();

    render(<InspectorPanel open sessionId="session-1" />);

    expect(screen.getByTestId('computer-empty-state')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Computer/i }));
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.queryByTestId('computer-empty-state')).not.toBeInTheDocument();
    const computerSection = screen.getByText('Computer').closest('section');
    expect(computerSection?.className).not.toContain('flex-1');

    vi.useRealTimers();
  });
});
