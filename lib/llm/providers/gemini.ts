import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';

/**
 * Google Gemini provider adapter for the DevAsk LLM abstraction.
 * 
 * Creates a one-shot Gemini client using the user's BYOK API key.
 * Uses the Vercel AI SDK's @ai-sdk/google for native streaming support.
 * 
 * Default model: gemini-2.5-flash
 * 
 * Note: Gemini internally uses 'model' role instead of 'assistant'.
 * The Vercel AI SDK handles this role mapping automatically, so we
 * don't need explicit conversion here.
 */

export function createGeminiModel(apiKey: string, model?: string): LanguageModel {
  const google = createGoogleGenerativeAI({
    apiKey,
  });

  return google(model ?? 'gemini-2.5-flash');
}
