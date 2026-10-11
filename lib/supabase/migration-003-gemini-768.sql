-- ============================================
-- Migration 003: Gemini embeddings (768 dims)
-- Run once in the Supabase SQL Editor AFTER deploying the gemini embedder
-- and setting EMBEDDING_PROVIDER=gemini + GEMINI_EMBEDDING_API_KEY.
-- Fresh setups can ignore this file — schema.sql already uses vector(384)
-- for the local default; run this only when switching to gemini.
-- ============================================
--
-- Why: embeddings move from the local bge-small-en-v1.5 model (384 dims,
-- in-process ONNX) to the Google AI Studio embedding API
-- (gemini-embedding-2 at outputDimensionality=768, online). The two
-- vector spaces are incompatible, so old rows are deleted and every repo
-- must be re-indexed afterwards (delete + re-add each repo from the
-- dashboard; the dashboard "re-index" button creates a new row, so delete
-- first to avoid duplicates).
--
-- Safe to re-run: every statement is idempotent (IF EXISTS / fixed target
-- state). Switching back to local/voyage later needs the reverse
-- migration plus another re-index — same pattern as below.

-- 1. Drop old vectors (384-dim data cannot be cast to vector(768)).
delete from chunks;

-- 2. Resize the column (drop + recreate the vector index around it).
drop index if exists idx_chunks_embedding;
alter table chunks alter column embedding type vector(768);
create index if not exists idx_chunks_embedding on chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- 3. Update the similarity-search RPC signature (body unchanged).
-- Drop old signatures first: CREATE OR REPLACE will NOT replace a function
-- whose arg types differ — it would create a second overload and PostgREST
-- would reject the ambiguous match_chunks RPC call. Covers the committed
-- 384 schema plus 1024/1536 variants and drifted 768 overloads (dropped
-- here so the body/defaults below are canonical either way).
drop function if exists match_chunks(vector(384), uuid, float, int);
drop function if exists match_chunks(vector(1024), uuid, float, int);
drop function if exists match_chunks(vector(1536), uuid, float, int);
drop function if exists match_chunks(vector(768), uuid, float, int);
create or replace function match_chunks(
  query_embedding vector(768),
  target_repo_id uuid,
  match_threshold float default 0.3,
  match_count int default 10
)
returns table (
  id uuid,
  repo_id uuid,
  file_path text,
  content text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    chunks.id,
    chunks.repo_id,
    chunks.file_path,
    chunks.content,
    1 - (chunks.embedding <=> query_embedding) as similarity
  from chunks
  where chunks.repo_id = target_repo_id
    and 1 - (chunks.embedding <=> query_embedding) > match_threshold
  order by chunks.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- 4. Mark previously indexable repos as needing a re-index. Their vectors
-- are gone (step 1), so leaving them 'ready' would serve empty context.
-- Preserves existing metadata keys, only (over)writes error_message.
update repos
set index_status = 'failed',
    metadata = coalesce(metadata, '{}'::jsonb) ||
      '{"error_message": "Embedding model changed to Gemini (768 dims). Delete this repo and re-add it to re-index."}'::jsonb
where index_status in ('pending', 'indexing', 'ready');
