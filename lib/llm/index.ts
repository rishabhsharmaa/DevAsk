import { streamText, type LanguageModel, type ModelMessage } from 'ai';
import { createOpenAIModel } from './providers/openai';
import { createAnthropicModel } from './providers/anthropic';
import { createGeminiModel } from './providers/gemini';
import type { LLMConfig, LLMProvider } from '@/types';

/**
 * Unified LLM streaming router.
 * 
 * One function that switches on provider and delegates to the appropriate
 * adapter. Each adapter normalizes the provider's SDK into the Vercel AI
 * SDK's LanguageModel interface, so streamText() works identically
 * regardless of provider.
 * 
 * API keys are BYOK — taken from the client request, used for this single
 * call, never logged or persisted.
 */

/**
 * Create the appropriate LanguageModel instance for a given provider config.
 */
function getModel(config: LLMConfig): LanguageModel {
  switch (config.provider) {
    case 'openai':
      return createOpenAIModel(config.api_key, config.model);
    case 'anthropic':
      return createAnthropicModel(config.api_key, config.model);
    case 'gemini':
      return createGeminiModel(config.api_key, config.model);
    default:
      throw new Error(`Unsupported LLM provider: ${config.provider}`);
  }
}

/**
 * Stream a chat response from the user's chosen LLM provider.
 * 
 * @param config - Provider type + BYOK API key
 * @param messages - Conversation history in OpenAI message format
 * @param systemPrompt - System prompt with RAG context
 * @returns Vercel AI SDK streamText result (use .toDataStreamResponse() for the route handler)
 */
export async function streamChat(
  config: LLMConfig,
  messages: ModelMessage[],
  systemPrompt: string
) {
  const model = getModel(config);

  const result = streamText({
    model,
    system: systemPrompt,
    messages,
  });

  return result;
}

/**
 * Get the display name for a provider.
 */
export function getProviderDisplayName(provider: LLMProvider): string {
  const names: Record<LLMProvider, string> = {
    anthropic: 'Anthropic (Claude)',
    openai: 'OpenAI (GPT-4o)',
    gemini: 'Google (Gemini)',
  };
  return names[provider];
}
