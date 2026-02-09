import type { PptPipelineState, PptPipelineStep, PptStep, PptStepStatus } from './types';
import { getBrowserManager } from '../browser/manager';

type StreamEmitter = (payload: { data: string }) => Promise<void>;

interface StreamEvent {
  type: string;
  sessionId?: string;
  timestamp?: number;
  data?: any;
}

const PIPELINE_STEPS: Array<{ id: PptStep; label: string }> = [
  { id: 'research', label: 'Research' },
  { id: 'browsing', label: 'Browsing' },
  { id: 'reading', label: 'Reading' },
  { id: 'synthesizing', label: 'Synthesizing' },
  { id: 'generating', label: 'Generating files' },
  { id: 'finalizing', label: 'Finalizing' },
];

const SEARCH_TOOL_NAMES = new Set(['web_search', 'paper_search']);

export class PptPipelineController {
  private started = false;
  private state: PptPipelineState;
  private currentIndex = 0;
  private lastSearchCompleted = false;
  private readingStarted = false;
  private synthesizingStarted = false;
  private generatingStarted = false;
  private finalizingStarted = false;
  private browserLaunched = false;
  private navigating = false;

  constructor(private sessionId: string, private emit: StreamEmitter) {
    this.state = {
      steps: PIPELINE_STEPS.map((step) => ({
        id: step.id,
        label: step.label,
        status: 'pending' as PptStepStatus,
      })),
      currentStep: 'research',
      browseActivity: [],
    };
  }

  wrapStream<T extends { writeSSE: StreamEmitter }>(stream: T): T {
    const originalWrite = stream.writeSSE.bind(stream);
    return {
      ...stream,
      writeSSE: async (payload: { data: string }) => {
        await originalWrite(payload);
        return this.handleOutgoing(payload);
      },
    };
  }

  private async handleOutgoing(payload: { data: string }) {
    let event: StreamEvent | null = null;
    try {
      event = JSON.parse(payload.data) as StreamEvent;
    } catch {
      return;
    }

    if (!event || !event.type) return;

    if (!this.started && event.type === 'message.start') {
      await this.startPipeline();
      await this.startStep('research');
    }

    switch (event.type) {
      case 'tool.start': {
        const toolName = event.data?.toolName;
        if (SEARCH_TOOL_NAMES.has(toolName)) {
          await this.startStep('browsing');
          await this.emitBrowseActivity({
            action: 'search',
            query: event.data?.params?.query || event.data?.params?.queries?.[0],
          });
        }
        if (toolName === 'ppt_generator') {
          await this.startStep('generating');
        }
        break;
      }
      case 'tool.complete': {
        const toolName = event.data?.toolName;
        if (SEARCH_TOOL_NAMES.has(toolName)) {
          this.lastSearchCompleted = true;
          await this.emitSearchResults(event.data?.artifacts);
        }
        if (toolName === 'ppt_generator') {
          await this.completeStep('generating');
          await this.startStep('finalizing');
          await this.completeStep('finalizing');
        }
        break;
      }
      case 'file.created': {
        const filename = event.data?.filename || '';
        const mimeType = event.data?.mimeType || '';
        if (filename.endsWith('.pptx') || mimeType.includes('presentation')) {
          if (this.generatingStarted) {
            await this.completeStep('generating');
          }
          await this.startStep('finalizing');
          await this.completeStep('finalizing');
        }
        break;
      }
      case 'thinking.start': {
        if (this.generatingStarted || this.finalizingStarted) {
          break;
        }
        if (this.lastSearchCompleted && !this.readingStarted) {
          await this.startStep('reading');
        }
        break;
      }
      case 'message.delta': {
        if (this.generatingStarted || this.finalizingStarted) {
          break;
        }
        if (this.readingStarted && !this.synthesizingStarted) {
          await this.completeStep('reading');
          await this.startStep('synthesizing');
        }
        break;
      }
      default:
        break;
    }
  }

  private async startPipeline() {
    if (this.started) return;
    this.started = true;
    await this.emitEvent('ppt.pipeline.start', {
      steps: this.state.steps,
    });
  }

  private async startStep(stepId: PptStep) {
    const targetIndex = this.state.steps.findIndex((step) => step.id === stepId);
    if (targetIndex < 0) return;

    for (let i = 0; i < targetIndex; i++) {
      if (this.state.steps[i].status !== 'completed') {
        this.state.steps[i].status = 'completed';
        await this.emitStep(this.state.steps[i]);
      }
    }

    const target = this.state.steps[targetIndex];
    if (target.status === 'completed') {
      this.state.currentStep = stepId;
      this.currentIndex = targetIndex;
      return;
    }

    if (target.status !== 'running') {
      target.status = 'running';
      await this.emitStep(target);
    }

    this.state.currentStep = stepId;
    this.currentIndex = targetIndex;

    if (stepId === 'reading') this.readingStarted = true;
    if (stepId === 'synthesizing') this.synthesizingStarted = true;
    if (stepId === 'generating') this.generatingStarted = true;
    if (stepId === 'finalizing') this.finalizingStarted = true;
  }

  private async completeStep(stepId: PptStep) {
    const target = this.state.steps.find((step) => step.id === stepId);
    if (!target || target.status === 'completed') return;
    target.status = 'completed';
    await this.emitStep(target);
  }

  private async emitStep(step: PptPipelineStep) {
    await this.emitEvent('ppt.pipeline.step', {
      step: step.id,
      status: step.status,
      label: step.label,
    });
  }

  private async emitBrowseActivity(input: {
    action: 'search' | 'visit' | 'read';
    url?: string;
    title?: string;
    query?: string;
  }) {
    const activity = {
      ...input,
      timestamp: Date.now(),
    };
    this.state.browseActivity.push(activity);
    await this.emitEvent('browse.activity', activity);
  }

  private async emitSearchResults(artifacts?: Array<{ content?: string }>) {
    if (!artifacts?.length) return;
    const content = artifacts[0]?.content;
    if (!content) return;
    try {
      const parsed = JSON.parse(content);
      // Support multiple shapes: .results (web_search, paper_search), .data, or array at top level
      const results = Array.isArray(parsed?.results)
        ? parsed.results
        : Array.isArray(parsed?.data)
          ? parsed.data
          : Array.isArray(parsed)
            ? parsed
            : [];
      const urls: Array<{ url: string; title?: string }> = [];
      for (const result of results.slice(0, 5)) {
        const resultUrl: string | undefined =
          result?.url ?? result?.link ?? result?.href ?? (typeof result === 'string' ? result : undefined);
        if (!resultUrl || !resultUrl.startsWith('http')) continue;
        urls.push({ url: resultUrl, title: result?.title ?? resultUrl });
        await this.emitBrowseActivity({
          action: 'visit',
          url: resultUrl,
          title: result?.title ?? resultUrl,
        });
      }
      if (urls.length > 0) {
        this.navigateToResults(urls).catch((err) => {
          console.error('[PptPipeline] navigateToResults error:', err);
        });
      }
    } catch (err) {
      console.error('[PptPipeline] emitSearchResults error:', err);
      return;
    }
  }

  /**
   * Launch a Playwright browser session and navigate to search result URLs
   * so the frontend BrowserViewport can show real screenshots.
   */
  private async navigateToResults(urls: Array<{ url: string; title?: string }>) {
    if (this.navigating) return;
    this.navigating = true;

    const manager = getBrowserManager();
    if (!manager.isEnabled()) {
      console.log('[PptPipeline] Browser not enabled, skipping visual navigation');
      this.navigating = false;
      return;
    }

    console.log(`[PptPipeline] Launching browser for ${urls.length} URLs`);

    try {
      // Ensure a browser page exists for this session
      const page = await manager.getPage(this.sessionId);
      if (!page) {
        console.error('[PptPipeline] Failed to get browser page');
        this.navigating = false;
        return;
      }

      // Start screencast and emit browser.launched on first call
      if (!this.browserLaunched) {
        this.browserLaunched = true;
        const screencastStarted = await manager.startScreencast(this.sessionId);
        console.log(`[PptPipeline] Screencast started: ${screencastStarted}`);
        await this.emitEvent('browser.launched', { message: 'Browser session started' });
      }

      for (const entry of urls) {
        try {
          console.log(`[PptPipeline] Navigating to: ${entry.url}`);
          await page.goto(entry.url, { waitUntil: 'domcontentloaded', timeout: 12000 });
          const finalUrl = page.url();
          const title = await page.title();
          manager.setCurrentUrl(this.sessionId, finalUrl, title);
          await this.emitEvent('browser.navigated', { url: finalUrl, title });
          await this.emitEvent('browser.action', {
            action: 'browser_navigate',
            params: { url: entry.url },
            success: true,
          });
          // Brief pause so user can see the page screenshot
          await new Promise((r) => setTimeout(r, 2500));
          // Capture screenshot for this action so timeline scrubber can show it
          try {
            const buf = await page.screenshot({
              type: 'jpeg',
              quality: 60,
              timeout: 5000,
            });
            const base64 = Buffer.isBuffer(buf) ? buf.toString('base64') : (buf as string);
            await this.emitEvent('browser.screenshot', { screenshot: base64 });
          } catch (_) {
            /* non-fatal; omit screenshot */
          }
        } catch (err) {
          console.error(`[PptPipeline] Navigation failed for ${entry.url}:`, err);
          // Skip pages that fail to load
        }
      }
    } catch (err) {
      console.error('[PptPipeline] navigateToResults fatal error:', err);
    } finally {
      this.navigating = false;
    }
  }

  private async emitEvent(type: string, data: any) {
    await this.emit({
      data: JSON.stringify({
        type,
        sessionId: this.sessionId,
        timestamp: Date.now(),
        data,
      }),
    });
  }
}
