/**
 * RAG embedding layer tests (fast, offline).
 *
 * Covers provider dispatch, batching rules, retrieval threshold resolution,
 * and chunking invariants. Touches no network — see
 * `scripts/benchmark-local-embeddings.ts` for the live API check.
 *
 * Run: npm test
 * (runs with placeholder Supabase env — the service client is constructed
 * at import time but never called, so no network happens)
 */
import './shim-websocket';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveEmbeddingProvider,
  getActiveDimension,
  getActiveModelName,
} from '../lib/rag/embedder';
import { packBatches, VOYAGE_DIMENSION } from '../lib/rag/voyage';
import {
  packBatches as packGeminiBatches,
  GEMINI_DIMENSION,
  DEFAULT_GEMINI_EMBEDDING_MODEL,
} from '../lib/rag/gemini';
import { resolveRetrievalThreshold, isDimensionMismatchMessage } from '../lib/rag/retriever';
import { chunkFile } from '../lib/rag/chunker';

const SAVED_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.EMBEDDING_PROVIDER;
  delete process.env.GEMINI_EMBEDDING_MODEL;
  delete process.env.RETRIEVAL_THRESHOLD;
});

afterEach(() => {
  process.env = { ...SAVED_ENV };
});

describe('resolveEmbeddingProvider', () => {
  it('defaults to gemini when unset', () => {
    assert.equal(resolveEmbeddingProvider({}), 'gemini');
    assert.equal(resolveEmbeddingProvider(), 'gemini');
  });

  it('honors explicit gemini/voyage (case-insensitive, trimmed)', () => {
    assert.equal(resolveEmbeddingProvider({ EMBEDDING_PROVIDER: 'voyage' }), 'voyage');
    assert.equal(resolveEmbeddingProvider({ EMBEDDING_PROVIDER: 'GEMINI' }), 'gemini');
    assert.equal(resolveEmbeddingProvider({ EMBEDDING_PROVIDER: '  Voyage ' }), 'voyage');
    assert.equal(resolveEmbeddingProvider({ EMBEDDING_PROVIDER: 'gemini' }), 'gemini');
  });

  it('throws on unknown providers instead of guessing', () => {
    assert.throws(
      () => resolveEmbeddingProvider({ EMBEDDING_PROVIDER: 'openai' }),
      /Invalid EMBEDDING_PROVIDER/
    );
  });

  it('rejects the removed local provider with migration guidance', () => {
    assert.throws(
      () => resolveEmbeddingProvider({ EMBEDDING_PROVIDER: 'local' }),
      /was removed.*EMBEDDING_PROVIDER=gemini/
    );
  });
});

describe('active provider metadata', () => {
  it('reports gemini dimension/model by default', () => {
    assert.equal(getActiveDimension(), 768);
    assert.equal(getActiveModelName(), DEFAULT_GEMINI_EMBEDDING_MODEL);
  });

  it('reports voyage dimension/model when selected', () => {
    process.env.EMBEDDING_PROVIDER = 'voyage';
    assert.equal(getActiveDimension(), 1024);
    assert.equal(getActiveModelName(), 'voyage-code-4');
  });

  it('pins the gemini default to the Embedding 2 API id', () => {
    // The API id is `gemini-embedding-2`, not `gemini-embedding-002`.
    assert.equal(DEFAULT_GEMINI_EMBEDDING_MODEL, 'gemini-embedding-2');
  });

  it('honors GEMINI_EMBEDDING_MODEL override', () => {
    process.env.EMBEDDING_PROVIDER = 'gemini';
    process.env.GEMINI_EMBEDDING_MODEL = 'my-embedding-model';
    assert.equal(getActiveModelName(), 'my-embedding-model');
  });
});

describe('dimensions', () => {
  it('gemini is 768, voyage is 1024', () => {
    assert.equal(GEMINI_DIMENSION, 768);
    assert.equal(VOYAGE_DIMENSION, 1024);
  });
});

describe('packBatches (voyage, char-budgeted)', () => {
  it('returns no batches for empty input', () => {
    assert.deepEqual(packBatches([]), []);
  });

  it('packs texts up to the char budget', () => {
    const batches = packBatches(['aa', 'bb', 'cc'], 4);
    assert.deepEqual(batches, [['aa', 'bb'], ['cc']]);
  });

  it('never drops an over-budget text (own batch, no infinite loop)', () => {
    const batches = packBatches(['toolongtext'], 4);
    assert.deepEqual(batches, [['toolongtext']]);
  });
});

describe('packBatches (gemini, char- and count-budgeted)', () => {
  it('returns no batches for empty input', () => {
    assert.deepEqual(packGeminiBatches([]), []);
  });

  it('packs texts up to the char budget', () => {
    const batches = packGeminiBatches(['aa', 'bb', 'cc'], 4, 100);
    assert.deepEqual(batches, [['aa', 'bb'], ['cc']]);
  });

  it('splits on the count cap even when chars fit', () => {
    const batches = packGeminiBatches(['a', 'b', 'c'], 100, 2);
    assert.deepEqual(batches, [['a', 'b'], ['c']]);
  });

  it('never drops an over-budget text (own batch, no infinite loop)', () => {
    const batches = packGeminiBatches(['toolongtext'], 4, 100);
    assert.deepEqual(batches, [['toolongtext']]);
  });
});

describe('resolveRetrievalThreshold', () => {
  it('defaults to 0.3', () => {
    assert.equal(resolveRetrievalThreshold({}), 0.3);
    assert.equal(resolveRetrievalThreshold(), 0.3);
  });

  it('honors RETRIEVAL_THRESHOLD', () => {
    assert.equal(resolveRetrievalThreshold({ RETRIEVAL_THRESHOLD: '0.5' }), 0.5);
  });

  it('falls back to default on garbage', () => {
    assert.equal(resolveRetrievalThreshold({ RETRIEVAL_THRESHOLD: 'nope' }), 0.3);
  });
});

describe('isDimensionMismatchMessage', () => {
  it('detects operator-time dimension errors', () => {
    assert.equal(
      isDimensionMismatchMessage('different vector dimensions 1024 and 384'),
      true
    );
  });

  it('detects insert-time dimension errors', () => {
    assert.equal(
      isDimensionMismatchMessage('expected 1024 dimensions, not 384'),
      true
    );
  });

  it('ignores unrelated errors', () => {
    assert.equal(isDimensionMismatchMessage('connection refused'), false);
  });
});

describe('chunkFile', () => {
  it('keeps tiny files as one chunk with a file-path prefix', () => {
    const chunks = chunkFile('a.ts', 'export const x = 1;\n');
    assert.equal(chunks.length, 1);
    assert.ok(chunks[0].content.startsWith('// File: a.ts\n'));
    assert.equal(chunks[0].file_path, 'a.ts');
  });

  it('emits exactly one chunk when the file fits (no tail slivers)', () => {
    // Regression test: the overlap backtrack used to re-slice the final
    // chunk's tail one line at a time (~+overlapLines junk chunks/file).
    const line = 'const value = computeSomething(alpha, beta, gamma);\n';
    const chunks = chunkFile('small.ts', line.repeat(20));
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].start_line, 1);
  });

  it('splits long files into bounded, line-tagged chunks', () => {
    const line = 'const value = computeSomething(alpha, beta, gamma); // work\n';
    const chunks = chunkFile('big.ts', line.repeat(200));
    assert.ok(chunks.length > 1);
    for (const chunk of chunks) {
      // 1500-char target + short-line overshoot + path prefix stays small.
      assert.ok(chunk.content.length < 2000, `chunk too large: ${chunk.content.length}`);
      assert.ok(chunk.start_line >= 1 && chunk.end_line >= chunk.start_line);
      assert.ok(chunk.content.startsWith('// File: big.ts\n'));
    }
  });
});
