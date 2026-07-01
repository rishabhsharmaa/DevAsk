/**
 * File-aware text chunker for RAG indexing.
 * 
 * Strategy:
 * - Target ~500 tokens per chunk (≈2000 chars, using 4 chars/token heuristic)
 * - 50-token overlap (≈200 chars) between adjacent chunks
 * - Tries to split at natural boundaries (blank lines, closing braces)
 * - Each chunk is tagged with file path + line range for citations
 */

const TARGET_CHUNK_SIZE = 2000;    // ~500 tokens in chars
const OVERLAP_SIZE = 200;          // ~50 tokens overlap
const MIN_CHUNK_SIZE = 100;        // Don't create tiny chunks

export interface TextChunk {
  file_path: string;
  content: string;
  start_line: number;
  end_line: number;
}

/**
 * Split a single file's content into overlapping chunks.
 */
export function chunkFile(filePath: string, content: string): TextChunk[] {
  // Skip empty or very small files
  if (!content || content.trim().length < MIN_CHUNK_SIZE) {
    // Still include the file if it has any content at all — even small files
    // can contain important config or type definitions
    if (content && content.trim().length > 0) {
      return [{
        file_path: filePath,
        content: `// File: ${filePath}\n${content}`,
        start_line: 1,
        end_line: content.split('\n').length,
      }];
    }
    return [];
  }

  const lines = content.split('\n');
  const chunks: TextChunk[] = [];
  let currentStart = 0;

  while (currentStart < lines.length) {
    // Accumulate lines until we hit the target chunk size
    let currentSize = 0;
    let currentEnd = currentStart;

    while (currentEnd < lines.length && currentSize < TARGET_CHUNK_SIZE) {
      currentSize += lines[currentEnd].length + 1; // +1 for newline
      currentEnd++;
    }

    // Try to find a natural break point near the end
    if (currentEnd < lines.length) {
      const breakPoint = findNaturalBreak(lines, currentEnd, currentStart);
      if (breakPoint > currentStart) {
        currentEnd = breakPoint;
      }
    }

    // Build the chunk content with file path prefix for context
    const chunkLines = lines.slice(currentStart, currentEnd);
    const chunkContent = `// File: ${filePath}\n${chunkLines.join('\n')}`;

    chunks.push({
      file_path: filePath,
      content: chunkContent,
      start_line: currentStart + 1,   // 1-indexed
      end_line: currentEnd,
    });

    // Move forward, accounting for overlap
    const overlapLines = calculateOverlapLines(lines, currentEnd, OVERLAP_SIZE);
    currentStart = Math.max(currentEnd - overlapLines, currentStart + 1);
  }

  return chunks;
}

/**
 * Find a natural break point near the target position.
 * Looks backwards from `target` for blank lines, closing braces, or function boundaries.
 */
function findNaturalBreak(
  lines: string[],
  target: number,
  minPos: number
): number {
  // Search window: up to 10 lines before the target
  const searchStart = Math.max(target - 10, minPos + 1);

  for (let i = target; i >= searchStart; i--) {
    const line = lines[i]?.trim() ?? '';

    // Best breaks: blank lines, closing braces, end of functions/classes
    if (line === '') return i + 1;
    if (line === '}' || line === '};') return i + 1;
    if (line === '---') return i + 1; // Markdown horizontal rules
    if (line.startsWith('##')) return i; // Markdown headings
  }

  // No natural break found, use the target position as-is
  return target;
}

/**
 * Calculate how many lines to overlap based on target char count.
 */
function calculateOverlapLines(
  lines: string[],
  endPos: number,
  targetOverlapChars: number
): number {
  let charCount = 0;
  let lineCount = 0;

  for (let i = endPos - 1; i >= 0 && charCount < targetOverlapChars; i--) {
    charCount += lines[i].length + 1;
    lineCount++;
  }

  return lineCount;
}

/**
 * Chunk multiple files. Main entry point for the indexing pipeline.
 */
export function chunkFiles(
  files: { path: string; content: string }[]
): TextChunk[] {
  const allChunks: TextChunk[] = [];

  for (const file of files) {
    const chunks = chunkFile(file.path, file.content);
    allChunks.push(...chunks);
  }

  return allChunks;
}
