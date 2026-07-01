import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

/**
 * OpenAI provider adapter for the DevAsk LLM abstraction.
 * 
 * Creates a one-shot OpenAI client using the user's BYOK API key.
 * Uses the Vercel AI SDK's @ai-sdk/openai for native streaming support.
 * 
 * Default model: gpt-4o
 */

export function createOpenAIModel(apiKey: string, model?: string): LanguageModel {
  const openai = createOpenAI({
    apiKey,
    // Compatibility: don't set a custom baseURL — use OpenAI's default
  });

  return openai(model ?? 'gpt-4o');
}
