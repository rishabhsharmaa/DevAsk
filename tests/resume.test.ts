/**
 * Resume-diff tests (fast, offline).
 *
 * Locks the deduplication contract POST /api/repo/resume relies on: only
 * chunks with no exact-content match already stored get (re-)embedded.
 * Wrong here means either duplicated rows or silently skipped chunks.
 * (The route itself can't import under plain tsx — it pulls Clerk's
 * server-only entry — so the pure helper it calls is what's tested.)
 *
 * Run: npm test
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { selectMissingChunks } from '../lib/rag/resume';
import type { TextChunk } from '../lib/rag/chunker';

function chunk(file_path: string, content: string): TextChunk {
  return { file_path, content, start_line: 1, end_line: 2 };
}

describe('selectMissingChunks', () => {
  it('returns everything when nothing is stored yet', () => {
    const chunks = [chunk('a.ts', 'a1'), chunk('b.ts', 'b1')];
    assert.deepEqual(selectMissingChunks(chunks, []), chunks);
  });

  it('returns nothing when all chunks are stored', () => {
    const chunks = [chunk('a.ts', 'a1'), chunk('b.ts', 'b1')];
    assert.deepEqual(selectMissingChunks(chunks, ['a1', 'b1']), []);
  });

  it('returns only the missing chunks, in original order', () => {
    const chunks = [chunk('a.ts', 'a1'), chunk('b.ts', 'b1'), chunk('c.ts', 'c1')];
    assert.deepEqual(selectMissingChunks(chunks, ['b1']), [chunks[0], chunks[2]]);
  });

  it('matches by exact content, not by path', () => {
    const chunks = [chunk('a.ts', 'same body'), chunk('b.ts', 'same body')];
    // One stored row with that body covers both identical texts.
    assert.deepEqual(selectMissingChunks(chunks, ['same body']), []);
    // A different body is still missing even for a known path.
    assert.deepEqual(selectMissingChunks([chunk('a.ts', 'new body')], ['old body']), [
      chunk('a.ts', 'new body'),
    ]);
  });

  it('ignores stored rows that no longer chunk the same way', () => {
    const chunks = [chunk('a.ts', 'a1')];
    assert.deepEqual(selectMissingChunks(chunks, ['stale body', 'a1']), []);
  });
});
