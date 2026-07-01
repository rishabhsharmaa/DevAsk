-- ============================================
-- DevAsk — Supabase Database Schema
-- Run this in the Supabase SQL Editor to set up the database.
-- ============================================

-- Enable pgvector for embedding storage + similarity search
create extension if not exists vector;

-- ============================================
-- Users table — synced with Clerk user IDs
-- ============================================
create table users (
  id text primary key,                        -- Clerk user ID
  github_token text,                          -- OAuth token for private repo access
  plan text not null default 'free',          -- 'free' | 'pro'
  payment_provider text,                      -- 'stripe' | 'razorpay'
  stripe_customer_id text,
  stripe_subscription_id text,
  razorpay_customer_id text,
  plan_expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================
-- Repos table — indexed GitHub repositories
-- ============================================
create table repos (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id),
  url text not null,
  owner text not null,                        -- GitHub owner (user or org)
  name text not null,                         -- GitHub repo name
  language text,                              -- Auto-detected primary language
  index_status text not null default 'pending', -- pending | indexing | ready | failed
  metadata jsonb,                             -- { summary, architecture, file_count, ... }
  created_at timestamptz not null default now()
);

create index idx_repos_user_id on repos(user_id);

-- ============================================
-- Chunks table — RAG vector store
-- ============================================
create table chunks (
  id uuid primary key default gen_random_uuid(),
  repo_id uuid not null references repos(id) on delete cascade,
  file_path text not null,
  content text not null,
  embedding vector(1536),                     -- text-embedding-3-small dimension
  created_at timestamptz not null default now()
);

-- IVFFlat index for fast cosine similarity search
-- Note: requires at least ~100 rows before building; 
-- for production, consider HNSW index instead for better query performance
create index idx_chunks_embedding on chunks 
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index idx_chunks_repo_id on chunks(repo_id);

-- ============================================
-- Conversations table — persistent chat sessions
-- ============================================
create table conversations (
  id uuid primary key default gen_random_uuid(),
  repo_id uuid not null references repos(id) on delete cascade,
  user_id text not null references users(id),
  is_public boolean not null default false,   -- For shareable links
  created_at timestamptz not null default now()
);

create index idx_conversations_repo_id on conversations(repo_id);
create index idx_conversations_user_id on conversations(user_id);

-- ============================================
-- Messages table — conversation history
-- ============================================
create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null,                         -- 'user' | 'assistant'
  content text not null,
  source_chunks jsonb,                        -- [{ file_path, content, similarity }]
  created_at timestamptz not null default now()
);

create index idx_messages_conversation_id on messages(conversation_id);

-- ============================================
-- Row Level Security (RLS)
-- Users can only read/write their own data.
-- Webhook handlers bypass RLS via service role client.
-- ============================================

alter table users enable row level security;
alter table repos enable row level security;
alter table chunks enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;

-- Users: can only access their own row
-- Note: auth.jwt() ->> 'sub' extracts the Clerk user ID from the JWT
create policy "Users can read own data" on users
  for select using (id = auth.jwt() ->> 'sub');

create policy "Users can update own data" on users
  for update using (id = auth.jwt() ->> 'sub');

-- Repos: can only access repos they own
create policy "Users can read own repos" on repos
  for select using (user_id = auth.jwt() ->> 'sub');

create policy "Users can insert own repos" on repos
  for insert with check (user_id = auth.jwt() ->> 'sub');

create policy "Users can update own repos" on repos
  for update using (user_id = auth.jwt() ->> 'sub');

create policy "Users can delete own repos" on repos
  for delete using (user_id = auth.jwt() ->> 'sub');

-- Chunks: accessible if user owns the parent repo
create policy "Users can read chunks of own repos" on chunks
  for select using (
    repo_id in (select id from repos where user_id = auth.jwt() ->> 'sub')
  );

create policy "Users can insert chunks for own repos" on chunks
  for insert with check (
    repo_id in (select id from repos where user_id = auth.jwt() ->> 'sub')
  );

-- Conversations: can only access own conversations (+ public ones for sharing)
create policy "Users can read own conversations" on conversations
  for select using (
    user_id = auth.jwt() ->> 'sub' or is_public = true
  );

create policy "Users can insert own conversations" on conversations
  for insert with check (user_id = auth.jwt() ->> 'sub');

create policy "Users can update own conversations" on conversations
  for update using (user_id = auth.jwt() ->> 'sub');

-- Messages: accessible if user owns the parent conversation (or it's public)
create policy "Users can read messages of accessible conversations" on messages
  for select using (
    conversation_id in (
      select id from conversations 
      where user_id = auth.jwt() ->> 'sub' or is_public = true
    )
  );

create policy "Users can insert messages in own conversations" on messages
  for insert with check (
    conversation_id in (
      select id from conversations where user_id = auth.jwt() ->> 'sub'
    )
  );

-- ============================================
-- RPC function for similarity search
-- Called by lib/rag/retriever.ts via supabase.rpc()
-- ============================================
create or replace function match_chunks(
  query_embedding vector(1536),
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
