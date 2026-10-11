/**
 * Embedding provider dispatcher.
 *
 * DevAsk generates embeddings with one of two online providers:
 * - `gemini` (default): Google AI Studio embedding REST API — see
 *   `./gemini.ts`. Requires GEMINI_EMBEDDING_API_KEY.
 * - `voyage`: Voyage AI `voyage-code-4` REST API — see `./voyage.ts`.
 *   Requires VOYAGE_API_KEY. Preserved for comparison / fallback.
 *
 * (The former `local` provider — in-process ONNX via Transformers.js — was
 * removed entirely. `EMBEDDING_PROVIDER=local` now fails fast with migration
 * guidance instead of loading a model.)
 *
 * Select with EMBEDDING_PROVIDER=gemini|voyage (default: gemini). The provider
 * is resolved on every call, so flipping the variable takes effect without a
 * restart for dispatch purposes.
 *
 * DO NOT add a silent cross-provider fallback here. Embeddings from different
 * providers live in different vector spaces — mixing them corrupts retrieval.
 */

import type { EmbeddingProvider } from '@/types';
import {
  generateEmbeddings as voyageGenerateEmbeddings,
  generateQueryEmbedding as voyageGenerateQueryEmbedding,
  VOYAGE_DIMENSION,
} from './voyage';
import {
  generateEmbeddings as geminiGenerateEmbeddings,
  generateQueryEmbedding as geminiGenerateQueryEmbedding,
  getGeminiModelName,
  GEMINI_DIMENSION,
} from './gemini';

export interface EmbeddedBatch {
  /** The input texts of this batch, in order. */
  texts: string[];
  /** Embeddings aligned 1:1 with `texts`. */
  embeddings: number[][];
  /** Offset of this batch within the full input array. */
  startIndex: number;
  /** Index of this batch (0-based) and total batch count. */
  batchIndex: number;
  batchCount: number;
}

/**
 * Resolve the active provider from the environment.
 * Pure function of `env` (default: process.env) so it is easy to probe.
 * Throws on unknown values — fail fast instead of guessing a provider.
 */
export function resolveEmbeddingProvider(
  env: Record<string, string | undefined> = process.env
): EmbeddingProvider {
  const raw = (env.EMBEDDING_PROVIDER ?? 'gemini').trim().toLowerCase();
  if (raw === 'gemini' || raw === 'voyage') return raw;
  if (raw === 'local') {
    throw new Error(
      'The local embedding provider was removed — embeddings now run online via ' +
        'Gemini. Set EMBEDDING_PROVIDER=gemini with GEMINI_EMBEDDING_API_KEY ' +
        '(your Google AI Studio key), run lib/supabase/migration-003-gemini-768.sql, ' +
        'and re-index your repos.'
    );
  }
  throw new Error(
    `Invalid EMBEDDING_PROVIDER "${env.EMBEDDING_PROVIDER}". Expected "gemini" (default) or "voyage".`
  );
}

/** Active provider for the current process environment. */
export function getEmbeddingProvider(): EmbeddingProvider {
  return resolveEmbeddingProvider();
}

/**
 * Generate embeddings for a batch of text strings.
 * Returns embeddings in the same order as the input texts.
 *
 * `onBatch` (awaited after each batch) lets callers persist incrementally
 * so progress is visible — and survivable — before the full run completes.
 */
export async function generateEmbeddings(
  texts: string[],
  onProgress?: (completed: number, total: number) => void,
  onBatch?: (batch: EmbeddedBatch) => Promise<void>
): Promise<number[][]> {
  if (resolveEmbeddingProvider() === 'voyage') {
    return voyageGenerateEmbeddings(texts, onProgress, onBatch);
  }
  return geminiGenerateEmbeddings(texts, onProgress, onBatch);
}

/**
 * Generate a single embedding for a query string.
 * Always uses the same provider/model as document embeddings.
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  if (resolveEmbeddingProvider() === 'voyage') {
    return voyageGenerateQueryEmbedding(query);
  }
  return geminiGenerateQueryEmbedding(query);
}

/** Vector dimension produced by the active provider. Must match the DB column. */
export function getActiveDimension(): number {
  return resolveEmbeddingProvider() === 'voyage'
    ? VOYAGE_DIMENSION
    : GEMINI_DIMENSION;
}

/**
 * Human-readable model identifier for the active provider.
 * Stamped into `repos.metadata.embedding_model` at index time so retrieval
 * can refuse to mix indexes built by different providers/models.
 */
export function getActiveModelName(): string {
  return resolveEmbeddingProvider() === 'voyage'
    ? 'voyage-code-4'
    : getGeminiModelName();
}
