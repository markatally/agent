import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserViewport } from '../BrowserViewport';

vi.mock('../../../hooks/useBrowserStream', () => ({
  useBrowserStream: () => ({
    frameDataUrl: null,
    status: 'idle',
    error: null,
  }),
}));

const SAMPLE_SNAPSHOT =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675"><rect width="1200" height="675" fill="#ddd" /></svg>'
  );

describe('BrowserViewport', () => {
  it('uses FIT mode ratio style by default', () => {
    render(<BrowserViewport sessionId="s1" enabled={false} snapshotUrl={SAMPLE_SNAPSHOT} />);

    const viewport = screen.getByTestId('browser-viewport');
    expect(viewport.style.aspectRatio).toBe('1.7777777777777777');
  });

  it('uses FILL mode with fillHeight minHeight style', () => {
    render(
      <BrowserViewport
        sessionId="s1"
        enabled={false}
        snapshotUrl={SAMPLE_SNAPSHOT}
        sizingMode="fill"
        fillHeight
        minHeight={180}
      />
    );

    const viewport = screen.getByTestId('browser-viewport');
    expect(viewport.style.minHeight).toBe('180px');
  });

  it('uses PIXEL mode with scroll container semantics', () => {
    render(
      <BrowserViewport
        sessionId="s1"
        enabled={false}
        snapshotUrl={SAMPLE_SNAPSHOT}
        sizingMode="pixel"
        fillHeight
        minHeight={200}
      />
    );

    const viewport = screen.getByTestId('browser-viewport');
    expect(viewport.style.minHeight).toBe('200px');
    expect(viewport.className).toContain('overflow-auto');
  });
});

