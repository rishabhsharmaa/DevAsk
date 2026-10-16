/**
 * Resume-diff tests (fast, offline).
 *
 * Locks the deduplication contract POST /api/repo/resume relies on: only
 * chunks with no exact-content match in the store are embedded.
 *
 * Run: npm test
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { TextChunk } from '../lib/rag/chunker';
import { selectMissingChunks } from '../lib/rag/resume';

function chunk(file_path: string, content: string): TextChunk {
  return { file_path, content, start_line: 1, end_line: 1 };
}

describe('selectMissingChunks', () => {
  it('returns everything in order when the store is empty', () => {
    const chunks = [chunk('a.ts', 'a1'), chunk('b.ts', 'b1')];
    assert.deepEqual(selectMissingChunks(chunks, []), chunks);
  });

  it('returns nothing when every chunk is already stored', () => {
    const chunks = [chunk('a.ts', 'a1'), chunk('b.ts', 'b1')];
    assert.deepEqual(selectMissingChunks(chunks, ['a1', 'b1']), []);
  });

  it('returns only the missing chunks, preserving order', () => {
    const chunks = [chunk('a.ts', 'a1'), chunk('b.ts', 'b1'), chunk('c.ts', 'c1')];
    assert.deepEqual(selectMissingChunks(chunks, ['b1']), [chunks[0], chunks[2]]);
  });

  it('treats identical chunk texts as one stored row', () => {
    const chunks = [chunk('a.ts', 'same body'), chunk('b.ts', 'same body')];
    assert.deepEqual(selectMissingChunks(chunks, ['same body']), []);
  });

  it('requires an exact match — near-misses still embed', () => {
    assert.deepEqual(selectMissingChunks([chunk('a.ts', 'new body')], ['old body']), [
      chunk('a.ts', 'new body'),
    ]);
  });

  it('ignores stale stored contents that match nothing', () => {
    const chunks = [chunk('a.ts', 'a1')];
    assert.deepEqual(selectMissingChunks(chunks, ['stale body', 'a1']), []);
  });
});
