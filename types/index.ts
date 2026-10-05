// ============================================
// Shared TypeScript types for all DevAsk entities.
// Single source of truth — import from '@/types' everywhere.
// ============================================

// --- Enums as union types (simpler than TS enums for serialization) ---

export type Plan = 'free' | 'pro';

export type IndexStatus = 'pending' | 'indexing' | 'ready' | 'failed';

export type LLMProvider = 'anthropic' | 'openai' | 'gemini';

export type PaymentProvider = 'stripe' | 'razorpay';

export type MessageRole = 'user' | 'assistant';

// --- Database row types (mirror the Supabase schema) ---

export interface User {
  id: string;                       // Clerk user ID
  github_token: string | null;
  plan: Plan;
  payment_provider: PaymentProvider | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  razorpay_customer_id: string | null;
  plan_expires_at: string | null;   // ISO 8601 timestamptz
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
}

export interface Chunk {
  id: string;                       // UUID
  repo_id: string;
  file_path: string;
  content: string;
  // embedding is vector(1024) — not sent to client, only used server-side
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

export interface CheckoutRequest {
  plan: 'pro';
}

export interface CheckoutResponse {
  provider: PaymentProvider;
  // Stripe: redirect URL
  checkout_url?: string;
  // Razorpay: order details for popup
  order_id?: string;
  razorpay_key?: string;
  amount?: number;
  currency?: string;
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
  gemini: 'gemini-2.5-flash',
} as const;

// --- Plan feature gates ---

export const PLAN_LIMITS: Record<Plan, {
  max_repos: number;
  private_repos: boolean;
  providers: LLMProvider[];
  persistent_history: boolean;
  shareable_links: boolean;
  export_chat: boolean;
}> = {
  free: {
    max_repos: 2,
    private_repos: false,
    providers: ['openai'],           // Free tier: single provider only
    persistent_history: false,
    shareable_links: false,
    export_chat: false,
  },
  pro: {
    max_repos: Infinity,
    private_repos: true,
    providers: ['anthropic', 'openai', 'gemini'],
    persistent_history: true,
    shareable_links: true,
    export_chat: true,
  },
} as const;
