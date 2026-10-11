'use client';

import React, { useState, useEffect, use, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser, useAuth } from '@clerk/nextjs';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { ArrowLeft, PanelLeft } from 'lucide-react';
import { supabase, setBrowserTokenGetter } from '@/lib/supabase/client';
import { FileExplorer } from '@/components/file-explorer';
import { ChatInput } from '@/components/chat/chat-input';
import { MessageList } from '@/components/chat/message-list';
import { ProviderSelector } from '@/components/provider-selector';
import { CodeViewer } from '@/components/code-viewer';
import { SourceRow } from '@/components/source-row';
import { StatusBadge } from '@/components/status';
import { InlineError } from '@/components/state';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { LLMProvider, Plan, Repo, SourceChunk, Message } from '@/types';

/** DB message mapped into the chat shape (assignable to the AI SDK UIMessage). */
interface ChatMessageInit {
  id: string;
  role: 'user' | 'assistant';
  parts: { type: 'text'; text: string }[];
  metadata: { source_chunks: SourceChunk[] | null };
}

function elapsedSince(iso: string, now: number): string {
  const start = new Date(iso).getTime();
  if (Number.isNaN(start)) return '—';
  const s = Math.max(0, Math.floor((now - start) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${String(s % 60).padStart(2, '0')}s`;
}

/** Short display name for a stamped embedding model id (never fabricated). */
function embeddingDisplayName(id: string): string {
  const low = id.toLowerCase();
  if (low.includes('gemini-embedding')) return 'Gemini Embedding';
  if (low.includes('voyage-code')) return 'Voyage Code';
  return id.length > 34 ? `${id.slice(0, 33)}…` : id;
}

/** Where stamped embeddings ran, when the model id makes it unambiguous. */
function embeddingOrigin(id: string): string | null {
  const low = id.toLowerCase();
  if (low.includes('voyage') || low.includes('gemini')) return 'API';
  return null;
}

export default function RepoChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { user, isLoaded: authLoaded } = useUser();
  const { getToken } = useAuth();
  const { id: repoId } = use(params);

  // Register the Clerk JWT getter before any query fires (runs first on mount).
  useEffect(() => {
    setBrowserTokenGetter(getToken);
  }, [getToken]);

  // DB States
  const [repo, setRepo] = useState<Repo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [files, setFiles] = useState<{ path: string }[]>([]);
  const [chunkTotal, setChunkTotal] = useState<number | null>(null);
  const [plan, setPlan] = useState<Plan>('free');
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Live indexing facts from the status API (never fabricated).
  const [liveFileCount, setLiveFileCount] = useState<number | null>(null);
  const [liveChunkCount, setLiveChunkCount] = useState<number | null>(null);
  const [liveChunkTotal, setLiveChunkTotal] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // UI / LLM State
  const [provider, setProvider] = useState<LLMProvider>('openai');
  const [apiKey, setApiKey] = useState('');
  const [providerOpen, setProviderOpen] = useState(false);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [activeCodeViewer, setActiveCodeViewer] = useState<{ path: string; content: string } | null>(null);
  const [activeCitation, setActiveCitation] = useState<SourceChunk | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<ChatMessageInit[]>([]);

  // Load files and existing chat history
  async function loadFilesAndHistory(userId: string) {
    try {
      // 1. Fetch file paths
      const { data: chunks } = await supabase
        .from('chunks')
        .select('file_path')
        .eq('repo_id', repoId);

      const uniquePaths = Array.from(new Set(chunks?.map((c) => c.file_path) || [])).map((p) => ({ path: p }));
      setFiles(uniquePaths);
      setChunkTotal(chunks?.length ?? null);

      // 2. Fetch existing conversation for this repo
      const { data: convs } = await supabase
        .from('conversations')
        .select('id')
        .eq('repo_id', repoId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (convs && convs.length > 0) {
        const convId = convs[0].id;
        setConversationId(convId);

        // Fetch past messages
        const { data: msgs } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: true });

        if (msgs) {
          const formatted = msgs.map((m) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            parts: [{ type: 'text' as const, text: m.content }],
            metadata: {
              source_chunks: m.source_chunks,
            },
          }));
          setInitialMessages(formatted);
        }
      }
    } catch (err) {
      console.error('Failed to load files and chat history:', err);
    }
  }

  // Load User, Plan, and Repo metadata on mount
  useEffect(() => {
    if (!authLoaded || !user) return;
    const userId = user.id;

    async function loadData() {
      try {
        // 1. Load User Plan details
        const { data: userRow } = await supabase
          .from('users')
          .select('plan')
          .eq('id', userId)
          .single();
        if (userRow) setPlan(userRow.plan as Plan);

        // 2. Load Repo Status
        const { data: repoRow, error: repoError } = await supabase
          .from('repos')
          .select('*')
          .eq('id', repoId)
          .single();

        if (repoError || !repoRow) {
          setLoadError(
            repoError?.message ||
              'Repository not found or you no longer have access to it.'
          );
          return;
        }
        setRepo(repoRow as Repo);

        if (repoRow.index_status === 'ready') {
          loadFilesAndHistory(userId);
        }
      } catch (err) {
        console.error('Failed to load initial data:', err);
        setLoadError(err instanceof Error ? err.message : 'Failed to load repository.');
      }
    }

    loadData();
  }, [user, authLoaded, repoId]);

  // Poll indexing status if not ready
  useEffect(() => {
    if (!repo || repo.index_status === 'ready' || repo.index_status === 'failed') return;

    const tick = setInterval(() => setNow(Date.now()), 1000);

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/repo/status?repo_id=${repoId}`);
        if (!res.ok) return;

        const data = await res.json();
        if (typeof data.file_count === 'number') setLiveFileCount(data.file_count);
        if (typeof data.chunk_count === 'number') setLiveChunkCount(data.chunk_count);
        if (typeof data.metadata?.total_chunks === 'number') setLiveChunkTotal(data.metadata.total_chunks);

        if (data.index_status === 'ready') {
          clearInterval(interval);
          // Refetch the row: the server stamped language + embedding metadata
          // at ready-time, and the mounted copy predates it.
          const { data: fresh } = await supabase
            .from('repos')
            .select('*')
            .eq('id', repoId)
            .single();
          setRepo((prev) => ((fresh as Repo | null) ?? (prev ? { ...prev, index_status: 'ready' } : null)));
          if (user) loadFilesAndHistory(user.id);
        } else if (data.index_status === 'failed') {
          clearInterval(interval);
          setRepo((prev) => prev ? { ...prev, index_status: 'failed' } : null);
        } else if (data.index_status) {
          setRepo((prev) => prev ? { ...prev, index_status: data.index_status } : null);
        }
      } catch (err) {
        console.error('Error polling repo status:', err);
      }
    }, 3000);

    return () => {
      clearInterval(interval);
      clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo?.index_status, repoId, user]);

  // Static chat transport. useChat instantiates its Chat (and captures our
  // transport) exactly once on first render, so request fields MUST NOT come
  // from a body() closure over state — it would send first-render values
  // forever (notably api_key: '', rejected with 400). Instead the transport
  // carries no body and each sendMessage() passes fresh values via its
  // per-request `body` option, which the transport merges at top level.
  const transport = useMemo(
    () =>
      new DefaultChatTransport<ChatMessageInit>({
        api: '/api/chat',
        fetch: async (input, init) => {
          const response = await globalThis.fetch(input, init);
          // Extract conversation ID from response headers if newly created
          const headerConvId = response.headers.get('x-conversation-id');
          if (headerConvId) {
            setConversationId((prev) => prev ?? headerConvId);
          }
          return response;
        },
      }),
    []
  );

  // Vercel AI SDK useChat Configuration
  const {
    messages,
    status,
    sendMessage,
    setMessages,
    error: chatError,
  } = useChat({
    transport,
    messages: initialMessages,
    onFinish: () => {
      // Refetch history to sync database message IDs and source chunk citations
      if (user && conversationId) {
        loadHistoryOnly(conversationId);
      }
    },
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  const uiMessagesForList: Message[] = messages.map((m) => {
    const content = m.parts
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('');

    return {
      id: m.id,
      conversation_id: conversationId || '',
      role: m.role as 'user' | 'assistant',
      content: content,
      source_chunks:
        (m.metadata as { source_chunks?: SourceChunk[] | null } | undefined)
          ?.source_chunks || null,
      created_at: '',
    };
  });

  // Sources behind the latest answer — shown in the context panel.
  const latestSources: SourceChunk[] =
    [...uiMessagesForList].reverse().find((m) => m.role === 'assistant' && m.source_chunks?.length)
      ?.source_chunks ?? [];

  // Embedding stamp recorded at index time (absent on legacy indexes).
  const stampedModel = repo?.metadata?.embedding_model ?? null;
  const stampedDims = repo?.metadata?.embedding_dimensions ?? null;
  const stampedSub = stampedModel
    ? [embeddingOrigin(stampedModel), stampedDims != null ? `${stampedDims} dimensions` : null]
        .filter(Boolean)
        .join(' · ')
    : null;

  // Keep useChat synced when initialMessages loads asynchronously
  useEffect(() => {
    if (initialMessages.length > 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages, setMessages]);

  async function loadHistoryOnly(convId: string) {
    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });

    if (msgs) {
      const formatted = msgs.map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        parts: [{ type: 'text' as const, text: m.content }],
        metadata: {
          source_chunks: m.source_chunks,
        },
      }));
      setMessages(formatted);
    }
  }

  // Handle starter questions click
  const handleStarterQuestion = (question: string) => {
    if (!apiKey) {
      setProviderOpen(true);
      return;
    }
    sendMessage(
      { text: question },
      {
        body: {
          repo_id: repoId,
          provider,
          api_key: apiKey,
          conversation_id: conversationId,
        },
      }
    );
  };

  // Handle chat submission
  const handleChatSubmit = (text: string) => {
    if (!apiKey) {
      setProviderOpen(true);
      return;
    }
    sendMessage(
      { text: text },
      {
        body: {
          repo_id: repoId,
          provider,
          api_key: apiKey,
          conversation_id: conversationId,
        },
      }
    );
  };

  // Open file content explorer
  const handleFileClick = async (filePath: string) => {
    setFileError(null);
    try {
      const { data: chunks, error } = await supabase
        .from('chunks')
        .select('content')
        .eq('repo_id', repoId)
        .eq('file_path', filePath)
        .order('id', { ascending: true }); // Keep line ordering

      if (error || !chunks) {
        throw new Error('Failed to retrieve file contents');
      }

      // Reconstruct file by stitching chunks together
      const fullContent = chunks.map((c) => c.content.replace(/^\/\/ File: .*\n/, '')).join('\n');
      setExplorerOpen(false);
      setActiveCodeViewer({ path: filePath, content: fullContent });
    } catch (err) {
      setFileError(
        `Could not fetch file contents: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  };

  // Load-failure UI (an actionable error instead of an infinite spinner)
  if (loadError) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background p-6">
        <div className="w-full max-w-md">
          <InlineError
            title="Couldn't load repository"
            body={loadError}
            action={{ label: 'Back to dashboard', onClick: () => router.push('/dashboard') }}
          />
        </div>
      </div>
    );
  }

  // Loading skeleton mirrors the workspace shape
  if (!repo) {
    return (
      <div className="flex h-full min-h-0 flex-1 animate-pulse flex-col" aria-label="Loading repository workspace">
        <div className="flex h-13 items-center justify-between border-b border-border px-4 sm:px-6">
          <div className="h-4 w-48 bg-muted" />
          <div className="h-8 w-40 bg-muted" />
        </div>
        <div className="grid min-h-0 flex-1 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="hidden space-y-2 border-r border-border p-4 lg:block">
            <div className="h-8 bg-muted" />
            <div className="h-3 w-3/4 bg-muted/70" />
            <div className="h-3 w-2/3 bg-muted/70" />
            <div className="h-3 w-1/2 bg-muted/70" />
          </div>
          <div className="mx-auto w-full max-w-3xl space-y-4 p-6">
            <div className="h-4 w-2/3 bg-muted" />
            <div className="h-4 w-full bg-muted/70" />
            <div className="h-4 w-5/6 bg-muted/70" />
            <div className="h-4 w-1/3 bg-muted/70" />
          </div>
        </div>
      </div>
    );
  }

  // Pending / Indexing / Failed states — honest, no fabricated progress.
  if (repo.index_status !== 'ready') {
    return (
      <div className="flex flex-1 items-center justify-center overflow-y-auto bg-background p-6">
        <div className="w-full max-w-lg">
          <p className="truncate font-mono text-xs text-muted-foreground">
            {repo.owner}/{repo.name}
          </p>
          {repo.index_status === 'failed' ? (
            <div className="mt-3">
              <InlineError
                title="Indexing failed"
                body={repo.metadata?.error_message || 'An error occurred during repository ingestion.'}
                action={{ label: 'Back to dashboard', onClick: () => router.push('/dashboard') }}
              />
            </div>
          ) : (
            <div className="mt-3 border border-border bg-card">
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <h2 className="text-[15px] font-semibold tracking-tight">
                  {repo.index_status === 'indexing' ? 'Indexing codebase' : 'Queued for indexing'}
                </h2>
                <StatusBadge status={repo.index_status} />
              </div>
              <dl className="grid grid-cols-3 divide-x divide-border border-b border-border">
                <div className="px-4 py-3">
                  <dt className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">Files</dt>
                  <dd className="mt-0.5 font-mono text-sm tabular">
                    {liveFileCount != null ? liveFileCount.toLocaleString() : '—'}
                  </dd>
                </div>
                <div className="px-4 py-3">
                  <dt className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">Chunks</dt>
                  <dd className="mt-0.5 font-mono text-sm tabular">
                    {liveChunkCount != null ? liveChunkCount.toLocaleString() : '—'}
                    {liveChunkTotal != null && liveChunkTotal > 0 && (
                      <span className="text-muted-foreground"> / {liveChunkTotal.toLocaleString()}</span>
                    )}
                  </dd>
                </div>
                <div className="px-4 py-3">
                  <dt className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">Elapsed</dt>
                  <dd className="mt-0.5 font-mono text-sm tabular">{elapsedSince(repo.created_at, now)}</dd>
                </div>
              </dl>
              <div className="px-4 py-3">
                <ol className="space-y-2 text-[13px]">
                  <IndexStep done label="Repository queued" />
                  <IndexStep
                    done={repo.index_status === 'indexing'}
                    active={repo.index_status === 'indexing'}
                    label="Crawling files and generating embeddings"
                  />
                  <IndexStep label="Ready to chat" />
                </ol>
                <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
                  This page updates live. Embeddings run online via the Gemini
                  API, paced for the free tier — large repos take a few minutes.
                  You can leave and come back.
                </p>
                <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')} className="mt-2 gap-1.5 px-0">
                  <ArrowLeft className="h-3.5 w-3.5" /> Return to dashboard
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-background">
      {/* Workspace top bar — always answers "where am I?" */}
      <header className="flex h-13 flex-shrink-0 items-center justify-between gap-2 border-b border-border px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={() => setExplorerOpen(true)}
            aria-label="Open file explorer"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
          <Link
            href="/dashboard"
            className="hidden flex-shrink-0 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Dashboard</span>
          </Link>
          <span aria-hidden className="hidden flex-shrink-0 text-muted-foreground/40 sm:inline">/</span>
          <p className="truncate font-mono text-sm font-semibold tracking-tight">
            {repo.owner}<span className="font-medium text-muted-foreground/60">/</span>{repo.name}
          </p>
          <div
            className="hidden flex-shrink-0 sm:block"
            title={`${files.length.toLocaleString()} files · ${chunkTotal != null ? chunkTotal.toLocaleString() : '—'} chunks`}
          >
            <StatusBadge status={repo.index_status} />
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center">
          <ProviderSelector
            provider={provider}
            setProvider={setProvider}
            apiKey={apiKey}
            setApiKey={setApiKey}
            plan={plan}
            open={providerOpen}
            onOpenChange={setProviderOpen}
          />
        </div>
      </header>

      {fileError && (
        <div className="flex-shrink-0 border-b border-border px-3 py-2 sm:px-4">
          <InlineError title="File unavailable" body={fileError} />
        </div>
      )}

      {/* Three regions — collapse gracefully by viewport.
          Each pane is an independent surface: fixed tracks never yield to
          content (min-w-0 + overflow clip on asides), so explorer expansion
          cannot resize or reflow the conversation. */}
      <div className="grid min-h-0 min-w-0 flex-1 grid-rows-[minmax(0,1fr)] overflow-x-clip lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_280px]">
        {/* LEFT: explorer (drawer below lg) */}
        <aside className="hidden min-h-0 min-w-0 flex-col overflow-hidden border-r border-border lg:flex" aria-label="File explorer">
          <FileExplorer files={files} onFileClick={handleFileClick} selectedPath={activeCodeViewer?.path} />
        </aside>

        {/* CENTER: conversation */}
        <div className="flex min-h-0 min-w-0 flex-col">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <MessageList
              messages={uiMessagesForList}
              onStarterClick={handleStarterQuestion}
              isLoading={isLoading}
              onCitationClick={(chunk) => setActiveCitation(chunk)}
            />
          </div>

          <div className="flex-shrink-0 border-t border-border bg-background px-3 py-3 sm:px-4">
            <div className="mx-auto w-full max-w-3xl">
              {chatError && (
                <div className="mb-2">
                  <InlineError title="Message failed to send" body={chatError.message} />
                </div>
              )}
              <ChatInput
                onSubmit={handleChatSubmit}
                isLoading={isLoading}
                disabled={!apiKey}
                provider={provider}
                hasKey={!!apiKey}
                onConnectKey={() => setProviderOpen(true)}
              />
            </div>
          </div>
        </div>

        {/* RIGHT: repository index (xl and up) */}
        <aside className="hidden min-h-0 min-w-0 flex-col overflow-hidden border-l border-border xl:flex" aria-label="Repository index">
          <div className="flex-shrink-0 border-b border-border p-4">
            <p className="label-micro text-muted-foreground">Index</p>
            <div className="mt-3">
              <p className="font-mono text-[26px] leading-none tabular">
                {files.length.toLocaleString()}
              </p>
              <p className="label-micro mt-1.5 text-muted-foreground">Files</p>
            </div>
            <div className="mt-4">
              <p className="font-mono text-[26px] leading-none tabular">
                {chunkTotal != null ? chunkTotal.toLocaleString() : '—'}
              </p>
              <p className="label-micro mt-1.5 text-muted-foreground">Chunks</p>
            </div>
            <div className="mt-4">
              <p className="truncate text-sm font-medium">{repo.language ?? '—'}</p>
              <p className="label-micro mt-1.5 text-muted-foreground">Primary language</p>
            </div>
            <div className="mt-4 border-t border-border/70 pt-3">
              <p className="label-micro text-muted-foreground">Embeddings</p>
              {stampedModel ? (
                <>
                  <p className="mt-1.5 truncate text-sm font-medium">
                    {embeddingDisplayName(stampedModel)}
                  </p>
                  {stampedSub && (
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{stampedSub}</p>
                  )}
                </>
              ) : (
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  Not recorded for this index.
                </p>
              )}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-4 [scrollbar-gutter:stable]">
            <div className="flex items-baseline justify-between gap-2">
              <p className="label-micro text-muted-foreground">Latest sources</p>
              {latestSources.length > 0 && (
                <p className="font-mono text-[11px] text-muted-foreground/70 tabular">
                  {latestSources.length}
                </p>
              )}
            </div>
            {latestSources.length === 0 ? (
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                Sources cited by the most recent answer appear here for quick inspection.
              </p>
            ) : (
              <div className="mt-1 divide-y divide-border/60">
                {latestSources.map((chunk, i) => (
                  <SourceRow
                    key={`${chunk.file_path}-${i}`}
                    index={i}
                    chunk={chunk}
                    onOpen={(c) => setActiveCitation(c)}
                  />
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Mobile explorer drawer */}
      <Sheet open={explorerOpen} onOpenChange={setExplorerOpen}>
        <SheetContent side="left" className="w-72 p-0 sm:w-80">
          <SheetHeader className="sr-only">
            <SheetTitle>File explorer</SheetTitle>
          </SheetHeader>
          <FileExplorer files={files} onFileClick={handleFileClick} selectedPath={activeCodeViewer?.path} />
        </SheetContent>
      </Sheet>

      {/* Code viewer dialog */}
      <Dialog open={activeCodeViewer !== null} onOpenChange={(open) => !open && setActiveCodeViewer(null)}>
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-hidden p-0">
          <DialogTitle className="sr-only">
            {activeCodeViewer ? `File: ${activeCodeViewer.path}` : 'File viewer'}
          </DialogTitle>
          {activeCodeViewer && (
            <CodeViewer
              path={activeCodeViewer.path}
              content={activeCodeViewer.content}
              className="max-h-[85vh] border-0"
              headerClassName="pr-12"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Citation inspector dialog */}
      <Dialog open={activeCitation !== null} onOpenChange={(open) => !open && setActiveCitation(null)}>
        <DialogContent className="max-h-[80vh] max-w-3xl overflow-hidden p-0">
          <DialogTitle className="sr-only">
            {activeCitation ? `Cited source: ${activeCitation.file_path}` : 'Cited source'}
          </DialogTitle>
          {activeCitation && (
            <CodeViewer
              path={activeCitation.file_path}
              content={activeCitation.content}
              similarity={activeCitation.similarity}
              className="max-h-[80vh] border-0"
              headerClassName="pr-12"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IndexStep({ done, active, label }: { done?: boolean; active?: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2.5">
      <span
        aria-hidden
        className={
          done
            ? 'h-1.5 w-1.5 rounded-full bg-success'
            : active
              ? 'h-1.5 w-1.5 animate-status-breathe rounded-full bg-signal'
              : 'h-1.5 w-1.5 rounded-full bg-muted-foreground/30'
        }
      />
      <span className={done || active ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
    </li>
  );
}
