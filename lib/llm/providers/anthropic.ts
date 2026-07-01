import { createAnthropic } from '@ai-sdk/anthropic';
import type { LanguageModel } from 'ai';

/**
 * Anthropic provider adapter for the DevAsk LLM abstraction.
 * 
 * Creates a one-shot Anthropic client using the user's BYOK API key.
 * Uses the Vercel AI SDK's @ai-sdk/anthropic for native streaming support.
 * 
 * Default model: claude-sonnet-4-6
 * 
 * Note: Anthropic uses a separate `system` parameter rather than a system
 * message in the messages array. The Vercel AI SDK handles this mapping
 * automatically when using streamText().
 */

export function createAnthropicModel(apiKey: string, model?: string): LanguageModel {
  const anthropic = createAnthropic({
    apiKey,
  });

  return anthropic(model ?? 'claude-sonnet-4-6');
}
