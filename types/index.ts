// ============================================
// Shared TypeScript types for all DevAsk entities.
// Single source of truth — import from '@/types' everywhere.
// ============================================

// --- Enums as union types (simpler than TS enums for serialization) ---
// (Plans were removed with the payment system — everything is free with
// no limits. The users table still carries unused subscription columns.)

export type IndexStatus = 'pending' | 'indexing' | 'ready' | 'failed';

export type LLMProvider = 'anthropic' | 'openai' | 'gemini';

export type MessageRole = 'user' | 'assistant';

/** RAG embedding backend — see lib/rag/embedder.ts (EMBEDDING_PROVIDER). */
export type EmbeddingProvider = 'gemini' | 'voyage';

// --- Database row types (mirror the Supabase schema) ---

export interface User {
  id: string;                       // Clerk user ID
  github_token: string | null;
  created_at: string;
}

export interface Repo {
  id: string;                       // UUID
  user_id: string;
  url: string;
  owner: string;
  name: string;
  language: string | null;
  index_status: IndexStatus;
  metadata: RepoMetadata | null;
  created_at: string;
}

export interface RepoMetadata {
  summary?: string;                 // Auto-generated README summary
  architecture?: string;            // Auto-generated architecture overview
  file_count?: number;
  total_chunks?: number;
  primary_language?: string;
  error_message?: string;
  embedding_model?: string;         // Model id that built this index (space tag)
  embedding_dimensions?: number;    // Vector width of this index
}

export interface Chunk {
  id: string;                       // UUID
  repo_id: string;
  file_path: string;
  content: string;
  // embedding is vector(768) with the gemini provider (vector(1024) with
  // voyage) — not sent to client, only used server-side
  created_at: string;
}

/** Chunk with similarity score, returned from retrieval */
export interface RetrievedChunk extends Chunk {
  similarity: number;
}

export interface Conversation {
  id: string;                       // UUID
  repo_id: string;
  user_id: string;
  is_public: boolean;
  created_at: string;
}

export interface Message {
  id: string;                       // UUID
  conversation_id: string;
  role: MessageRole;
  content: string;
  source_chunks: SourceChunk[] | null;  // File paths + snippets used as context
  created_at: string;
}

export interface SourceChunk {
  file_path: string;
  content: string;                  // The actual chunk text used as context
  similarity?: number;
}

// --- API request/response types ---

export interface IndexRepoRequest {
  url: string;                      // GitHub repo URL (e.g., https://github.com/owner/name)
}

export interface IndexRepoResponse {
  repo_id: string;
  status: IndexStatus;
}

export interface RepoStatusResponse {
  index_status: IndexStatus;
  file_count: number;
  chunk_count: number;
  metadata: RepoMetadata | null;
}

export interface ChatRequest {
  repo_id: string;
  conversation_id: string | null;   // null = create new conversation
  message: string;
  provider: LLMProvider;
  api_key: string;                  // BYOK — never persisted
  model?: string;                   // Optional model override
}

export interface ChatResponse {
  conversation_id: string;
  source_chunks: SourceChunk[];
}

// --- LLM provider config ---

export interface LLMConfig {
  provider: LLMProvider;
  api_key: string;
  model?: string;
}

/** Default models per provider */
export const DEFAULT_MODELS: Record<LLMProvider, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o',
  gemini: 'gemini-3.8-flash',
} as const;

