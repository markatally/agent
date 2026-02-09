import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPage = {
  goto: vi.fn(),
  title: vi.fn(),
  url: vi.fn(),
  screenshot: vi.fn(),
};

const mockManager = {
  isEnabled: vi.fn(),
  getPage: vi.fn(),
  startScreencast: vi.fn(),
  setCurrentUrl: vi.fn(),
};

vi.mock('../../apps/api/src/services/browser/manager', () => ({
  getBrowserManager: () => mockManager,
}));

import { PptPipelineController } from '../../apps/api/src/services/tasks/ppt_pipeline';

describe('PptPipelineController screenshot events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockManager.isEnabled.mockReturnValue(true);
    mockManager.getPage.mockResolvedValue(mockPage);
    mockManager.startScreencast.mockResolvedValue(true);
    mockManager.setCurrentUrl.mockReturnValue(undefined);
    mockPage.goto.mockResolvedValue(undefined);
    mockPage.title.mockResolvedValue('Example');
    mockPage.url.mockReturnValue('https://example.com');
    mockPage.screenshot.mockResolvedValue(Buffer.from('jpeg-data'));
  });

  it('emits browse.screenshot for visit steps during search-result navigation', async () => {
    const emitted: Array<{ type: string; data: any }> = [];
    const controller = new PptPipelineController('sess-1', async (payload) => {
      emitted.push(JSON.parse(payload.data));
    });

    const wrapped = controller.wrapStream({
      writeSSE: async () => Promise.resolve(),
    });

    await wrapped.writeSSE({
      data: JSON.stringify({ type: 'message.start', sessionId: 'sess-1' }),
    });

    await wrapped.writeSSE({
      data: JSON.stringify({
        type: 'tool.complete',
        sessionId: 'sess-1',
        data: {
          toolName: 'paper_search',
          artifacts: [
            {
              content: JSON.stringify({
                results: [{ link: 'https://example.com', title: 'Example title' }],
              }),
            },
          ],
        },
      }),
    });

    const eventTypes = emitted.map((event) => event.type);
    expect(eventTypes).toContain('browser.screenshot');
    expect(eventTypes).toContain('browse.screenshot');

    const browseScreenshot = emitted.find((event) => event.type === 'browse.screenshot');
    expect(browseScreenshot?.data?.visitIndex).toBe(0);
    expect(typeof browseScreenshot?.data?.screenshot).toBe('string');
    expect(browseScreenshot?.data?.screenshot.length).toBeGreaterThan(0);
  });
});

