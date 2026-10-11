import { supabaseAdmin } from '@/lib/supabase/service';
import { generateQueryEmbedding } from './embedder';
import type { RetrievedChunk } from '@/types';

/**
 * Semantic search retriever for the RAG pipeline.
 * 
 * Embeds the user's question, then queries the Supabase match_chunks
 * RPC function for cosine similarity search scoped to the target repo.
 */

const DEFAULT_TOP_K = 10;
// NOTE: 0.3 was tuned for Voyage voyage-code-4 similarity scores. Different
// embedding models distribute cosine scores differently, so re-evaluate this
// threshold against Gemini (see citations' match % in the UI, or the dev log
// line below). Override without code changes via RETRIEVAL_THRESHOLD.
const DEFAULT_THRESHOLD = 0.3;

/**
 * Detect Postgres/pgvector dimension errors: thrown when a query vector's
 * width differs from the indexed column — i.e. the index was built by a
 * different embedding model and must be rebuilt. Pure — easy to probe.
 */
export function isDimensionMismatchMessage(message: string): boolean {
  return /different vector dimensions|expected \d+ dimensions?/i.test(message);
}

/**
 * Resolve the similarity threshold from the environment.
 * Pure function of `env` (default: process.env) so it is easy to probe.
 */
export function resolveRetrievalThreshold(
  env: Record<string, string | undefined> = process.env
): number {
  const raw = Number(env.RETRIEVAL_THRESHOLD);
  return Number.isFinite(raw) ? raw : DEFAULT_THRESHOLD;
}

/**
 * Retrieve the most relevant chunks for a given query.
 * 
 * @param repoId - UUID of the repo to search within
 * @param query - The user's natural language question
 * @param topK - Number of results to return (default: 10)
 * @returns Chunks ordered by descending similarity
 */
export async function retrieveRelevantChunks(
  repoId: string,
  query: string,
  topK: number = DEFAULT_TOP_K
): Promise<RetrievedChunk[]> {
  // 1. Embed the user's question
  const queryEmbedding = await generateQueryEmbedding(query);

  // 2. Call the Supabase RPC function for similarity search
  const threshold = resolveRetrievalThreshold();
  const { data, error } = await supabaseAdmin.rpc('match_chunks', {
    query_embedding: queryEmbedding,
    target_repo_id: repoId,
    match_threshold: threshold,
    match_count: topK,
  });

  if (error) {
    console.error('Retrieval error:', error);
    if (error.message && isDimensionMismatchMessage(error.message)) {
      throw new Error(
        'Embedding dimension mismatch: this index was built with a different ' +
          `embedding model (${error.message}). Delete the repo and re-add it to re-index.`
      );
    }
    throw new Error(`Failed to retrieve chunks: ${error.message}`);
  }

  // 3. Fallback: broad questions ("summarize this repo") can score below
  // the threshold against every chunk. Rather than hand the model an
  // empty context, take the closest chunks regardless of score — the
  // model can judge relevance, and the UI shows the low match %.
  let rows = data ?? [];
  if (rows.length === 0) {
    const fallback = await supabaseAdmin.rpc('match_chunks', {
      query_embedding: queryEmbedding,
      target_repo_id: repoId,
      match_threshold: -1,
      match_count: topK,
    });
    if (!fallback.error && fallback.data) {
      rows = fallback.data;
    }
  }

  // Dev-only score inspection: one aggregated line per query (no content).
  if (process.env.NODE_ENV !== 'production') {
    const top = rows
      .slice(0, 3)
      .map(
        (r: { file_path: string; similarity: number }) =>
          `${r.file_path} ${(r.similarity * 100).toFixed(1)}%`
      )
      .join(', ');
    console.info(
      `[retrieval] ${rows.length} chunk(s), threshold=${threshold}, top: ${top || 'none'}`
    );
  }

  return rows.map((row: {
    id: string;
    repo_id: string;
    file_path: string;
    content: string;
    similarity: number;
  }) => ({
    id: row.id,
    repo_id: row.repo_id,
    file_path: row.file_path,
    content: row.content,
    similarity: row.similarity,
    created_at: '',  // Not returned by RPC, not needed for retrieval
  }));
}

/**
 * Build the system prompt with retrieved context chunks.
 * Formats chunks as numbered references for the LLM to cite.
 */
export function buildContextPrompt(
  chunks: RetrievedChunk[],
  repoName: string
): string {
  const contextBlocks = chunks
    .map((chunk, i) => {
      return `[Source ${i + 1}: ${chunk.file_path}]\n${chunk.content}`;
    })
    .join('\n\n---\n\n');

  return `You are an expert code assistant analyzing the "${repoName}" repository. 
You have access to the following source code excerpts retrieved from the codebase. 
Use them to answer the user's question accurately and specifically.

IMPORTANT RULES:
1. Always cite which source files you're referencing using the format [Source N: filepath].
2. If the retrieved context doesn't contain enough information to answer fully, say so honestly.
3. When showing code, use proper syntax highlighting with the language identifier.
4. Explain the code's purpose and how it fits into the broader architecture when relevant.
5. If multiple files are relevant, explain the relationships between them.

--- RETRIEVED CODE CONTEXT ---

${contextBlocks}

--- END CONTEXT ---

Answer the user's question based on the code context above. Always cite your sources.`;
}
