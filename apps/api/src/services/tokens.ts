import { get_encoding, Tiktoken } from 'tiktoken';
import { getConfig } from './config';
import type { LLMMessage } from './llm';

/**
 * Token Counter for context window management
 * Following SPEC.md pattern (lines 1858-1913)
 */
export class TokenCounter {
  private encoder: Tiktoken;

  constructor() {
    // Use cl100k_base encoding (GPT-4/ChatGPT compatible)
    // This works well with most OpenAI-compatible APIs
    this.encoder = get_encoding('cl100k_base');
  }

  /**
   * Count tokens in a text string
   */
  count(text: string): number {
    return this.encoder.encode(text).length;
  }

  /**
   * Count total tokens in an array of messages
   */
  countMessages(messages: LLMMessage[]): number {
    let total = 0;
    for (const msg of messages) {
      // Each message has overhead: role tokens + content + separators
      total += 4; // message overhead (approx: <|im_start|>, role, \n, <|im_end|>)
      total += this.count(msg.role);
      total += this.count(msg.content);
    }
    total += 2; // conversation overhead (priming)
    return total;
  }

  /**
   * Truncate messages to fit within a token limit
   * Keeps system message and most recent messages
   */
  truncateToFit(messages: LLMMessage[], maxTokens: number): LLMMessage[] {
    const result: LLMMessage[] = [];
    let currentTokens = 0;

    // Always include system message if present
    const systemMsg = messages.find((m) => m.role === 'system');
    if (systemMsg) {
      const systemTokens = this.countMessages([systemMsg]);
      currentTokens += systemTokens;
      result.push(systemMsg);
    }

    // Reserve some tokens for the response
    const reservedForResponse = 4096; // Reserve 4K tokens for response
    const effectiveMax = maxTokens - reservedForResponse;

    // Add messages from newest to oldest until limit
    const nonSystemMessages = messages.filter((m) => m.role !== 'system').reverse();
    const messagesToAdd: LLMMessage[] = [];

    for (const msg of nonSystemMessages) {
      const msgTokens = this.countMessages([msg]);
      if (currentTokens + msgTokens > effectiveMax) {
        break;
      }
      currentTokens += msgTokens;
      messagesToAdd.unshift(msg); // Add to front to maintain order
    }

    // Combine system message with other messages
    if (systemMsg) {
      return [systemMsg, ...messagesToAdd];
    }
    return messagesToAdd;
  }

  /**
   * Check if messages fit within context window
   */
  fitsInContext(messages: LLMMessage[], maxTokens?: number): boolean {
    const config = getConfig();
    const limit = maxTokens || config.session.contextWindowTokens;
    return this.countMessages(messages) <= limit;
  }

  /**
   * Get remaining tokens in context window
   */
  getRemainingTokens(messages: LLMMessage[], maxTokens?: number): number {
    const config = getConfig();
    const limit = maxTokens || config.session.contextWindowTokens;
    return Math.max(0, limit - this.countMessages(messages));
  }

  /**
   * Free the encoder resources
   */
  free(): void {
    this.encoder.free();
  }
}

// Singleton instance
let tokenCounterInstance: TokenCounter | null = null;

/**
 * Get or create the token counter singleton
 */
export function getTokenCounter(): TokenCounter {
  if (!tokenCounterInstance) {
    tokenCounterInstance = new TokenCounter();
  }
  return tokenCounterInstance;
}

/**
 * Reset the token counter (useful for testing)
 */
export function resetTokenCounter(): void {
  if (tokenCounterInstance) {
    tokenCounterInstance.free();
    tokenCounterInstance = null;
  }
}
