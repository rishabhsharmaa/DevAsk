-- ============================================
-- Migration 001: Voyage voyage-code-4 (1024 dims)
-- Run once in the Supabase SQL Editor AFTER deploying the new embedder.
-- Fresh setups can ignore this file — schema.sql already uses vector(1024).
-- ============================================
--
-- Why: embeddings move from OpenAI text-embedding-3-small (1536 dims)
-- to Voyage voyage-code-4 (1024 dims). Works from any current column width
-- (1536 or 768 variants — rows are deleted before the resize since old
-- vectors can't be cast and are incompatible anyway). Every repo must be
-- re-indexed afterwards (delete + re-add each repo from the dashboard;
-- the dashboard "re-index" button creates a new row, so delete first to
-- avoid duplicates).

-- 1. Drop old vectors (1536-dim data cannot be cast to vector(1024)).
delete from chunks;

-- 2. Resize the column (drop + recreate the vector index around it).
drop index if exists idx_chunks_embedding;
alter table chunks alter column embedding type vector(1024);
create index idx_chunks_embedding on chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- 3. Update the similarity-search RPC signature (body unchanged).
-- Drop old signatures first: CREATE OR REPLACE will NOT replace a function
-- whose arg types differ — it would create a second overload and PostgREST
-- would reject the ambiguous match_chunks RPC call. Covers both the
-- committed 1536 schema and 768 variants.
drop function if exists match_chunks(vector(1536), uuid, float, int);
drop function if exists match_chunks(vector(768), uuid, float, int);
create or replace function match_chunks(
  query_embedding vector(1024),
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
