import type { EmbeddedBatch } from './embedder';

/**
 * Google Gemini embedding provider (768 dimensions).
 * Reached only when EMBEDDING_PROVIDER=gemini — see `./embedder.ts`.
 *
 * Uses the platform-owned AI Studio key (not BYOK) since embeddings are a
 * platform cost during indexing, not a per-query user cost. Paste the same
 * key shown at https://aistudio.google.com into GEMINI_EMBEDDING_API_KEY.
 *
 * Uses raw REST instead of an SDK — one endpoint, no extra dependency
 * (same rationale as the Voyage adapter). Model id is configurable via
 * GEMINI_EMBEDDING_MODEL (default `gemini-embedding-2` — the API id is
 * `-2`, not `-002`); the requested output width is fixed at 768 dims
 * (Matryoshka-truncated from the native 3072) so vectors always fit the
 * 768-dim schema (see `lib/supabase/migration-003-gemini-768.sql`).
 * Overriding the model to one that rejects `outputDimensionality` fails
 * fast with the API's error — vectors are never silently stored at the
 * wrong width.
 *
 * Free-tier pacing (AI Studio: 100 RPM / 30K TPM / 1K RPD on the embedding
 * models): one serialized queue shared by every caller in this process
 * (indexing batches AND chat queries — they draw from the same key).
 * Batches are capped by chars AND count so a full request stays near
 * ~2K tokens, and requests are spaced 4s apart, keeping worst-case usage
 * at ~15 RPM / ~30K TPM. Chat queries outrank indexing batches, so a
 * message waits behind at most one in-flight request. 429/5xx responses
 * are retried with backoff that honors Retry-After. Tune via
 * GEMINI_REQUEST_INTERVAL_MS / GEMINI_MAX_BATCH_CHARS /
 * GEMINI_MAX_BATCH_COUNT / GEMINI_MAX_RETRIES without touching code.
 */

export const GEMINI_DIMENSION = 768;

/** Default embedding model id (without the `models/` prefix). */
export const DEFAULT_GEMINI_EMBEDDING_MODEL = 'gemini-embedding-2';

/** Active embedding model id (bare id, no `models/` prefix). */
export function getGeminiModelName(): string {
  return process.env.GEMINI_EMBEDDING_MODEL?.trim() || DEFAULT_GEMINI_EMBEDDING_MODEL;
}

function apiUrl(): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${getGeminiModelName()}:batchEmbedContents`;
}

function envInt(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

// ~2k tokens per request (~4 chars/token, same heuristic as the chunker).
const MAX_BATCH_CHARS = envInt('GEMINI_MAX_BATCH_CHARS', 8_000);
// batchEmbedContents request-count guard (well under the API maximum).
const MAX_BATCH_COUNT = envInt('GEMINI_MAX_BATCH_COUNT', 16);
// Spacing between requests — the primary TPM guard (see header).
const REQUEST_INTERVAL_MS = envInt('GEMINI_REQUEST_INTERVAL_MS', 4_000);
const MAX_RETRIES = envInt('GEMINI_MAX_RETRIES', 8);
// Backoff when the API gives no Retry-After: 2s → 4s → … capped at 60s.
const RETRY_BASE_MS = 2_000;
const RETRY_MAX_MS = 60_000;

function getApiKey(): string {
  const apiKey = process.env.GEMINI_EMBEDDING_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Missing GEMINI_EMBEDDING_API_KEY. This is the platform key for embeddings ' +
        '(your Google AI Studio key — same one used for Gemini chat), not a user BYOK key.'
    );
  }
  return apiKey;
}

interface GeminiBatchResponse {
  embeddings?: { values: number[] }[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Pack texts into batches capped by total char count AND request count.
 * Pure function — kept separate so the batching rule is easy to probe.
 * A single over-budget text still gets its own batch (never dropped,
 * never an infinite loop); the API truncates over-long inputs.
 */
export function packBatches(
  texts: string[],
  maxChars: number = MAX_BATCH_CHARS,
  maxCount: number = MAX_BATCH_COUNT
): string[][] {
  const batches: string[][] = [];
  let current: string[] = [];
  let currentChars = 0;

  for (const text of texts) {
    if (
      current.length > 0 &&
      (currentChars + text.length > maxChars || current.length >= maxCount)
    ) {
      batches.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(text);
    currentChars += text.length;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

let currentDelayMs = REQUEST_INTERVAL_MS;

/** Current inter-request delay in ms. Exposed for observability / probes. */
export function geminiPacingState(): { delayMs: number } {
  return { delayMs: currentDelayMs };
}

function noteSuccess(): void {
  currentDelayMs = Math.max(REQUEST_INTERVAL_MS, currentDelayMs - 2_000);
}

function noteRateLimit(retryAfterMs: number | null): void {
  const raised = retryAfterMs ?? currentDelayMs * 2;
  currentDelayMs = Math.min(Math.max(raised, 10_000), 120_000);
}

interface Waiter {
  fn: () => Promise<unknown>;
  priority: number;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

const waiters: Waiter[] = [];
let pumping = false;

/**
 * Priority scheduler. Query embeddings (chat) outrank document batches
 * (indexing): a chat message waits behind at most one in-flight request
 * instead of a whole indexing backlog. FIFO within a priority; callers
 * never preempt a request already in flight.
 */
function enqueue<T>(fn: () => Promise<T>, priority = 0): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    waiters.push({
      fn: fn as () => Promise<unknown>,
      priority,
      resolve: resolve as (value: unknown) => void,
      reject,
    });
    void pump();
  });
}

async function pump(): Promise<void> {
  if (pumping) return;
  pumping = true;
  try {
    while (waiters.length > 0) {
      let next = 0;
      for (let i = 1; i < waiters.length; i++) {
        if (waiters[i].priority > waiters[next].priority) next = i;
      }
      const [waiter] = waiters.splice(next, 1);
      try {
        waiter.resolve(await waiter.fn());
      } catch (error) {
        waiter.reject(error);
      }
    }
  } finally {
    pumping = false;
  }
}

/** Pull a human-readable message out of an error body (often JSON). */
function friendlyDetail(body: string): string {
  try {
    const json = JSON.parse(body) as {
      error?: { message?: string; status?: string };
      message?: string;
    };
    return json.error?.message || json.message || body;
  } catch {
    return body;
  }
}

async function embedBatch(
  batch: string[],
  taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY'
): Promise<number[][]> {
  // Chat queries outrank indexing batches (see enqueue).
  const priority = taskType === 'RETRIEVAL_QUERY' ? 1 : 0;
  return enqueue(async () => {
    // Space this request from the previous one before sending.
    await sleep(currentDelayMs);

    const model = `models/${getGeminiModelName()}`;
    for (let attempt = 0; ; attempt++) {
      const response = await fetch(`${apiUrl()}?key=${encodeURIComponent(getApiKey())}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: batch.map((text) => ({
            model,
            content: { parts: [{ text }] },
            taskType,
            outputDimensionality: GEMINI_DIMENSION,
          })),
        }),
      });

      if (response.ok) {
        noteSuccess();
        const json = (await response.json()) as GeminiBatchResponse;
        const embeddings = json.embeddings ?? [];
        if (embeddings.length !== batch.length) {
          throw new Error(
            `Gemini embedding request returned ${embeddings.length} vectors for ${batch.length} texts.`
          );
        }
        // Fail fast on dimension drift: vectors must fit the DB column.
        if (embeddings.length > 0 && embeddings[0].values.length !== GEMINI_DIMENSION) {
          throw new Error(
            `Gemini model produced ${embeddings[0].values.length}-dimensional vectors, ` +
              `expected ${GEMINI_DIMENSION}. The configured model does not honor ` +
              `outputDimensionality — refusing to insert incompatible vectors.`
          );
        }
        return embeddings.map((item) => item.values);
      }

      // Retry on rate limits and transient server errors.
      const retryable = response.status === 429 || response.status >= 500;
      if (retryable && attempt < MAX_RETRIES) {
        const retryAfterSec = Number(response.headers.get('retry-after'));
        const retryAfterMs =
          Number.isFinite(retryAfterSec) && retryAfterSec > 0
            ? retryAfterSec * 1000
            : null;
        noteRateLimit(retryAfterMs);
        const delayMs =
          retryAfterMs ??
          Math.min(RETRY_BASE_MS * 2 ** attempt, RETRY_MAX_MS) +
            Math.floor(Math.random() * 500);
        console.warn(
          `[gemini] ${response.status} rate-limited ` +
            `(attempt ${attempt + 1}/${MAX_RETRIES + 1}), backing off ${Math.round(delayMs / 1000)}s`
        );
        await sleep(delayMs);
        continue;
      }

      const detail = await response.text().catch(() => '');
      throw new Error(
        `Gemini embedding request failed (${response.status}): ${friendlyDetail(detail)}`
      );
    }
  }, priority);
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
  const batches = packBatches(texts);
  const allEmbeddings: number[][] = new Array(texts.length);

  let batchStart = 0;
  for (let i = 0; i < batches.length; i++) {
    // No sleep here — embedBatch serializes through the shared queue,
    // which spaces every request by the adaptive delay.
    const embeddings = await embedBatch(batches[i], 'RETRIEVAL_DOCUMENT');
    for (let j = 0; j < embeddings.length; j++) {
      allEmbeddings[batchStart + j] = embeddings[j];
    }
    await onBatch?.({
      texts: batches[i],
      embeddings,
      startIndex: batchStart,
      batchIndex: i,
      batchCount: batches.length,
    });
    batchStart += batches[i].length;
    onProgress?.(batchStart, texts.length);
    console.info(
      `[gemini] embedded batch ${i + 1}/${batches.length} ` +
        `(${batchStart}/${texts.length} texts, ${Math.round(currentDelayMs / 1000)}s pacing)`
    );
  }

  return allEmbeddings;
}

/**
 * Generate a single embedding for a query string.
 * Used during retrieval (per-message, not batch).
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const [embedding] = await embedBatch([query], 'RETRIEVAL_QUERY');
  return embedding;
}
