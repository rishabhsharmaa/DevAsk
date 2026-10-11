/**
 * Embedding benchmark / smoke test (live API).
 * (Filename is historical — the local model this was written for is gone;
 * the script now exercises whichever API provider is active.)
 *
 * Embeds real code chunks sampled from this repository and reports:
 * batch config, throughput, RAM, and vector dimension.
 * Also asserts dimension + a same-text cosine-similarity sanity check.
 *
 * Usage:
 *   tsx scripts/benchmark-local-embeddings.ts [numChunks]
 *
 * Env: EMBEDDING_PROVIDER + the provider's API key. Capped to 5 texts —
 * API free tiers are request-paced, so bulk runs are impractical here.
 *
 * Run: npm run benchmark:embeddings
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

import {
  generateEmbeddings,
  generateQueryEmbedding,
  getActiveDimension,
  getActiveModelName,
  getEmbeddingProvider,
} from '../lib/rag/embedder';
import { chunkFile } from '../lib/rag/chunker';

// Sample from the working tree (`npm run` always sets CWD to the package root).
const PROJECT_ROOT = process.cwd();
// Representative TypeScript sources (app code, not fixtures).
const SAMPLE_DIRS = ['lib', 'app/api', 'components/chat'];
const DEFAULT_CHUNKS = 200;
const TEXT_CAP = 5;

function collectCodeFiles(): string[] {
  const files: string[] = [];
  for (const dir of SAMPLE_DIRS) {
    const abs = path.join(PROJECT_ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const entry of fs.readdirSync(abs, { recursive: true }) as string[]) {
      if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
        files.push(path.join(abs, entry));
      }
    }
  }
  return files.sort();
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // vectors are L2-normalized
}

function rssMB(): number {
  return Math.round(process.memoryUsage().rss / 1024 / 1024);
}

async function main(): Promise<void> {
  const provider = getEmbeddingProvider();
  const model = getActiveModelName();
  const expectedDims = getActiveDimension();

  let numChunks = Number(process.argv[2]) || DEFAULT_CHUNKS;
  if (numChunks > TEXT_CAP) {
    console.warn(
      `[benchmark] capping at ${TEXT_CAP} texts for provider "${provider}" (API pacing).`
    );
    numChunks = TEXT_CAP;
  }

  // Gather real code chunks.
  const texts: string[] = [];
  for (const file of collectCodeFiles()) {
    const rel = path.relative(PROJECT_ROOT, file);
    for (const chunk of chunkFile(rel, fs.readFileSync(file, 'utf8'))) {
      texts.push(chunk.content);
      if (texts.length >= numChunks) break;
    }
    if (texts.length >= numChunks) break;
  }
  assert.ok(texts.length > 0, 'no code chunks sampled — check SAMPLE_DIRS');
  console.log(`[benchmark] provider=${provider} model=${model}`);
  console.log(`[benchmark] sampled ${texts.length} code chunks from ${SAMPLE_DIRS.join(', ')}`);

  const rssBefore = rssMB();

  // Cold call: first request through the API queue.
  const coldStart = Date.now();
  const probe = await generateQueryEmbedding(texts[0].slice(0, 500));
  const coldMs = Date.now() - coldStart;
  assert.equal(probe.length, expectedDims, 'probe dimension mismatch');
  console.log(`[benchmark] cold single-text call: ${coldMs}ms`);
  console.log(`[benchmark] rss after load: ${rssBefore}MB -> ${rssMB()}MB`);

  // Bulk run.
  let batches = 0;
  const bulkStart = Date.now();
  const embeddings = await generateEmbeddings(
    texts,
    undefined,
    async () => {
      batches++;
    }
  );
  const bulkMs = Date.now() - bulkStart;
  assert.equal(embeddings.length, texts.length, 'embedding count mismatch');
  for (const vec of embeddings) {
    assert.equal(vec.length, expectedDims, 'bulk dimension mismatch');
    assert.ok(vec.every((v) => Number.isFinite(v)), 'non-finite vector value');
  }

  // Sanity: identical texts -> (near-)identical vectors; unrelated lower.
  const query = 'Where is the Supabase service client created?';
  const qVec = await generateQueryEmbedding(query);
  const sameVec = await generateQueryEmbedding(query);
  const otherVec = await generateQueryEmbedding('pineapple pizza topping preferences');
  const sameSim = cosine(qVec, sameVec);
  const otherSim = cosine(qVec, otherVec);
  assert.ok(sameSim > 0.999, `same-text similarity too low: ${sameSim}`);
  assert.ok(otherSim < sameSim, `unrelated text scored >= identical text (${otherSim} >= ${sameSim})`);

  const seconds = bulkMs / 1000;
  console.log('---');
  console.log(`Model:                 ${model}`);
  console.log(`Embedding dimension:   ${expectedDims}`);
  console.log(`Batch size:            n/a (API-paced)`);
  console.log(`Chunks embedded:       ${texts.length} in ${batches} batch(es)`);
  console.log(`Cold call:             ${(coldMs / 1000).toFixed(1)}s`);
  console.log(`Bulk time:             ${seconds.toFixed(1)}s`);
  console.log(`Throughput:            ${(texts.length / Math.max(seconds, 0.01)).toFixed(1)} chunks/sec`);
  console.log(`RSS before/after:      ${rssBefore}MB / ${rssMB()}MB`);
  console.log(`Sanity same/unrelated: ${sameSim.toFixed(4)} / ${otherSim.toFixed(4)}`);
  console.log('All benchmark assertions passed.');
}

main().catch((error) => {
  console.error('[benchmark] FAILED:', error instanceof Error ? error.message : error);
  process.exit(1);
});
