import type { TextChunk } from './chunker';

/**
 * Pure resume-diff helper (import-safe: no env, no network, no SDKs).
 *
 * Returns the chunks with no exact-content match in `existingContents`,
 * preserving the original order. Matching is by full chunk text, which
 * always carries a `// File:` prefix (see chunker.ts), so distinct files
 * can never collide. In the vanishingly rare case of two identical chunk
 * texts, both resolve to one stored row — harmless for retrieval.
 */
export function selectMissingChunks(
  chunks: TextChunk[],
  existingContents: string[]
): TextChunk[] {
  const have = new Set(existingContents);
  return chunks.filter((chunk) => !have.has(chunk.content));
}
