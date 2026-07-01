import OpenAI from 'openai';

/**
 * Embedding generator using OpenAI text-embedding-3-small (1536 dimensions).
 * 
 * Uses the platform-owned OpenAI key (not BYOK) since embeddings are a
 * platform cost during indexing, not a per-query user cost.
 * 
 * Batches chunks into groups of 100 to minimize API calls while staying
 * under the OpenAI batch size limit.
 */

const BATCH_SIZE = 100;
const EMBEDDING_MODEL = 'text-embedding-3-small';

// Lazy-initialized client — only created when embeddings are needed
let openaiClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'Missing OPENAI_API_KEY. This is the platform key for embeddings, not a user BYOK key.'
      );
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

export interface EmbeddingResult {
  index: number;
  embedding: number[];
}

/**
 * Generate embeddings for a batch of text strings.
 * Returns embeddings in the same order as the input texts.
 */
export async function generateEmbeddings(
  texts: string[],
  onProgress?: (completed: number, total: number) => void
): Promise<number[][]> {
  const client = getClient();
  const allEmbeddings: number[][] = new Array(texts.length);

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
    });

    for (const item of response.data) {
      allEmbeddings[i + item.index] = item.embedding;
    }

    onProgress?.(Math.min(i + BATCH_SIZE, texts.length), texts.length);
  }

  return allEmbeddings;
}

/**
 * Generate a single embedding for a query string.
 * Used during retrieval (per-message, not batch).
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const client = getClient();

  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: query,
  });

  return response.data[0].embedding;
}
