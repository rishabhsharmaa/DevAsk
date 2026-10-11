import type { EmbeddedBatch } from './embedder';

/**
 * Voyage AI embedding provider (voyage-code-4, 1024 dimensions).
 * Reached only when EMBEDDING_PROVIDER=voyage — see `./embedder.ts`.
 *
 * Uses the platform-owned Voyage key (not BYOK) since embeddings are a
 * platform cost during indexing, not a per-query user cost.
 *
 * Uses raw REST instead of the `voyageai` npm package — one endpoint,
 * no extra dependency.
 *
 * Rate-limit pacing: one serialized queue with an AIMD delay shared by
 * every caller in this process (indexing batches AND chat queries — they
 * draw from the same key). The delay doubles on each 429 and decays on
 * success, so paid keys sit at the base delay while constrained keys
 * (e.g. 3 RPM without a payment method) converge to a sustainable ~20s
 * spacing instead of failing. Chat queries outrank indexing batches, so a
 * message waits behind at most one in-flight request. 429/5xx responses are retried with backoff
 * that honors Retry-After. Tune via VOYAGE_REQUEST_INTERVAL_MS /
 * VOYAGE_MAX_BATCH_CHARS / VOYAGE_MAX_RETRIES without touching code.
 */

const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';
const EMBEDDING_MODEL = 'voyage-code-4';
export const VOYAGE_DIMENSION = 1024;

function envInt(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

// ~3k tokens per request (~4 chars/token, same heuristic as the chunker).
const MAX_BATCH_CHARS = envInt('VOYAGE_MAX_BATCH_CHARS', 12_000);
// Courtesy delay between healthy requests — NOT the rate limiter.
// The retry/backoff path below is what adapts to the key's real quota.
const REQUEST_INTERVAL_MS = envInt('VOYAGE_REQUEST_INTERVAL_MS', 1_000);
const MAX_RETRIES = envInt('VOYAGE_MAX_RETRIES', 8);
// Backoff when the API gives no Retry-After: 2s → 4s → … capped at 60s.
const RETRY_BASE_MS = 2_000;
const RETRY_MAX_MS = 60_000;

function getApiKey(): string {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Missing VOYAGE_API_KEY. This is the platform key for embeddings, not a user BYOK key.'
    );
  }
  return apiKey;
}

interface VoyageEmbeddingResponse {
  data: { embedding: number[]; index: number }[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Pack texts into batches capped by total char count.
 * Pure function — kept separate so the batching rule is easy to probe.
 * A single over-budget text still gets its own batch (never dropped,
 * never an infinite loop); the API truncates it via truncation: true.
 */
export function packBatches(texts: string[], maxChars: number = MAX_BATCH_CHARS): string[][] {
  const batches: string[][] = [];
  let current: string[] = [];
  let currentChars = 0;

  for (const text of texts) {
    if (current.length > 0 && currentChars + text.length > maxChars) {
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

/**
 * Shared pacing state. All Voyage calls in this process — indexing batches
 * and chat query embeddings alike — draw from one key, so they go through
 * one serialized queue with one adaptive delay. Without this, concurrent
 * callers each see a "quiet" client while jointly exceeding the quota.
 *
 * AIMD control: the delay doubles (min 10s) on every 429 and decays 2s per
 * success toward the base. A 3-RPM key converges to ~20s spacing and stays
 * there; a paid key sits at the base delay.
 */
let currentDelayMs = REQUEST_INTERVAL_MS;

/** Current inter-request delay in ms. Exposed for observability / probes. */
export function voyagePacingState(): { delayMs: number } {
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
 * (indexing): on a 3-RPM key, a chat message waits behind at most one
 * in-flight request instead of a whole indexing backlog. FIFO within a
 * priority; callers never preempt a request already in flight.
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
      Detail?: string;
      detail?: string;
      message?: string;
      error?: { message?: string };
    };
    return (
      json.Detail || json.detail || json.message || json.error?.message || body
    );
  } catch {
    return body;
  }
}

async function embedBatch(
  batch: string[],
  inputType: 'query' | 'document'
): Promise<number[][]> {
  // Chat queries outrank indexing batches (see enqueue).
  const priority = inputType === 'query' ? 1 : 0;
  return enqueue(async () => {
    // Space this request from the previous one before sending.
    await sleep(currentDelayMs);

    for (let attempt = 0; ; attempt++) {
      const response = await fetch(VOYAGE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getApiKey()}`,
        },
        body: JSON.stringify({
          input: batch,
          model: EMBEDDING_MODEL,
          input_type: inputType,
          output_dimension: VOYAGE_DIMENSION,
          truncation: true,
        }),
      });

      if (response.ok) {
        noteSuccess();
        const json = (await response.json()) as VoyageEmbeddingResponse;
        const embeddings: number[][] = new Array(batch.length);
        for (const item of json.data) {
          embeddings[item.index] = item.embedding;
        }
        return embeddings;
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
          `[voyage] ${response.status} rate-limited ` +
            `(attempt ${attempt + 1}/${MAX_RETRIES + 1}), backing off ${Math.round(delayMs / 1000)}s`
        );
        await sleep(delayMs);
        continue;
      }

      const detail = await response.text().catch(() => '');
      const hint =
        response.status === 429
          ? ' Voyage is rate-limiting this key (3 req/min without a payment method). If an index is running, wait for it to finish and retry — or add a payment method at dashboard.voyageai.com for standard limits (free tokens still apply).'
          : '';
      throw new Error(
        `Voyage embedding request failed (${response.status}): ${friendlyDetail(detail)}${hint}`
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
    const embeddings = await embedBatch(batches[i], 'document');
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
      `[voyage] embedded batch ${i + 1}/${batches.length} ` +
        `(${batchStart}/${texts.length} texts, ${Math.round(currentDelayMs / 1000)}s pacing)`
    );
  }

  return allEmbeddings;
}

/**
 * Generate a single embedding for a query string.
 * Used during retrieval (per-message, not batch).
 * No proactive pacing here — single user-driven calls sit far below
 * rate limits; 429s are still retried via embedBatch.
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const [embedding] = await embedBatch([query], 'query');
  return embedding;
}
