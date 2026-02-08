/**
 * Browser Service Types
 * Types for Playwright-based real browser execution per session
 */

/**
 * Browser configuration from config
 */
export interface BrowserConfig {
  enabled: boolean;
  maxConcurrentSessions: number;
  viewport: { width: number; height: number };
  idleTimeoutMs: number;
  screencast?: {
    format: 'jpeg' | 'png';
    quality?: number;
    maxWidth?: number;
    maxHeight?: number;
    everyNthFrame?: number;
  };
}

/**
 * Browser session info (Playwright types imported at runtime)
 */
export interface BrowserSessionInfo {
  sessionId: string;
  createdAt: number;
  status: 'launching' | 'active' | 'closed';
  currentUrl?: string;
  currentTitle?: string;
  screencastActive: boolean;
}

/**
 * Options for creating a browser session
 */
export interface CreateBrowserSessionOptions {
  sessionId: string;
}
