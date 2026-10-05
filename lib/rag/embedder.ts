/**
 * Embedding generator using Voyage AI voyage-code-4 (1024 dimensions).
 *
 * Uses the platform-owned Voyage key (not BYOK) since embeddings are a
 * platform cost during indexing, not a per-query user cost.
 *
 * Uses raw REST instead of the `voyageai` npm package — one endpoint,
 * no extra dependency (same rationale as the Razorpay adapter).
 *
 * Rate-limit pacing: defaults match the Voyage free tier (3 RPM / 10k TPM).
 * Texts are packed into char-budgeted batches (~4 chars/token, same heuristic
 * as the chunker) and bulk requests are spaced 20s apart, holding sustained
 * throughput just under both caps. If you raise Voyage limits, lower
 * REQUEST_INTERVAL_MS / raise MAX_BATCH_CHARS accordingly.
 * 429/5xx responses are retried with backoff (honoring Retry-After).
 */

const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';
const EMBEDDING_MODEL = 'voyage-code-4';
const OUTPUT_DIMENSION = 1024;

// ~3k tokens per request at 3 RPM ≈ 9k TPM sustained (cap: 10k TPM).
const MAX_BATCH_CHARS = 12_000;
const REQUEST_INTERVAL_MS = 20_000;
const MAX_RETRIES = 4;

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

async function embedBatch(
  batch: string[],
  inputType: 'query' | 'document',
  attempt = 0
): Promise<number[][]> {
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
      output_dimension: OUTPUT_DIMENSION,
      truncation: true,
    }),
  });

  if (response.ok) {
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
    const delayMs = Number.isFinite(retryAfterSec) && retryAfterSec > 0
      ? retryAfterSec * 1000
      : REQUEST_INTERVAL_MS * 2 ** attempt;
    await sleep(delayMs);
    return embedBatch(batch, inputType, attempt + 1);
  }

  const detail = await response.text().catch(() => '');
  throw new Error(`Voyage embedding request failed (${response.status}): ${detail}`);
}

/**
 * Generate embeddings for a batch of text strings.
 * Returns embeddings in the same order as the input texts.
 */
export async function generateEmbeddings(
  texts: string[],
  onProgress?: (completed: number, total: number) => void
): Promise<number[][]> {
  const batches = packBatches(texts);
  const allEmbeddings: number[][] = new Array(texts.length);

  let batchStart = 0;
  for (let i = 0; i < batches.length; i++) {
    if (i > 0) await sleep(REQUEST_INTERVAL_MS); // stay under 3 RPM
    const embeddings = await embedBatch(batches[i], 'document');
    for (let j = 0; j < embeddings.length; j++) {
      allEmbeddings[batchStart + j] = embeddings[j];
    }
    batchStart += batches[i].length;
    onProgress?.(batchStart, texts.length);
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
