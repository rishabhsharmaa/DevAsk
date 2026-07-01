'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { ArrowLeft, RefreshCw, AlertTriangle, FileCode, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { FileExplorer } from '@/components/file-explorer';
import { ChatInput } from '@/components/chat/chat-input';
import { MessageList } from '@/components/chat/message-list';
import { ProviderSelector } from '@/components/provider-selector';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LLMProvider, Plan, Repo, SourceChunk, Message } from '@/types';

export default function RepoChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { user, isLoaded: authLoaded } = useUser();
  const { id: repoId } = use(params);

  // DB States
  const [repo, setRepo] = useState<Repo | null>(null);
  const [files, setFiles] = useState<{ path: string }[]>([]);
  const [plan, setPlan] = useState<Plan>('free');
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Status Polling for Pending/Indexing Repos
  const [indexingProgress, setIndexingProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Checking index status...');

  // UI / LLM State
  const [provider, setProvider] = useState<LLMProvider>('openai');
  const [apiKey, setApiKey] = useState('');
  const [activeCodeViewer, setActiveCodeViewer] = useState<{ path: string; content: string } | null>(null);
  const [activeCitation, setActiveCitation] = useState<SourceChunk | null>(null);

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
        const { data: repoRow } = await supabase
          .from('repos')
          .select('*')
          .eq('id', repoId)
          .single();

        if (repoRow) {
          setRepo(repoRow as Repo);
          
          if (repoRow.index_status === 'ready') {
            loadFilesAndHistory(userId);
          }
        }
      } catch (err) {
        console.error('Failed to load initial data:', err);
      }
    }

    loadData();
  }, [user, authLoaded, repoId]);

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

  // Poll indexing status if not ready
  useEffect(() => {
    if (!repo || repo.index_status === 'ready' || repo.index_status === 'failed') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/repo/status?repo_id=${repoId}`);
        if (!res.ok) return;

        const data = await res.json();
        
        if (data.index_status === 'ready') {
          clearInterval(interval);
          setRepo((prev) => prev ? { ...prev, index_status: 'ready' } : null);
          if (user) loadFilesAndHistory(user.id);
        } else if (data.index_status === 'failed') {
          clearInterval(interval);
          setRepo((prev) => prev ? { ...prev, index_status: 'failed' } : null);
        } else {
          // Adjust fake progress bar
          setIndexingProgress((prev) => Math.min(prev + 10, 95));
          setStatusMessage(
            data.index_status === 'indexing'
              ? `Processing: Chunks embedded (${data.chunk_count} blocks generated)...`
              : 'Queueing files for parsing...'
          );
        }
      } catch (err) {
        console.error('Error polling repo status:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [repo, repoId, user]);

  // Vercel AI SDK useChat Configuration
  const [initialMessages, setInitialMessages] = useState<any[]>([]);

  const {
    messages,
    status,
    sendMessage,
    setMessages,
  } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: () => ({
        repo_id: repoId,
        provider,
        api_key: apiKey,
        conversation_id: conversationId,
      }),
      fetch: async (input, init) => {
        const response = await globalThis.fetch(input, init);
        // Extract conversation ID from response headers if newly created
        const headerConvId = response.headers.get('x-conversation-id');
        if (headerConvId && !conversationId) {
          setConversationId(headerConvId);
        }
        return response;
      },
    }),
    messages: initialMessages,
    onFinish: ({ message }) => {
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
      source_chunks: (m.metadata as any)?.source_chunks || null,
      created_at: '',
    };
  });

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
      setMessages(formatted as any);
    }
  }

  // Handle starter questions click
  const handleStarterQuestion = (question: string) => {
    if (!apiKey) {
      alert('Please enter your LLM API key first.');
      return;
    }
    sendMessage({
      text: question,
    });
  };

  // Handle chat submission
  const handleChatSubmit = (text: string) => {
    if (!apiKey) {
      alert('Please enter your LLM API key first.');
      return;
    }
    sendMessage({
      text: text,
    });
  };

  // Open file content explorer
  const handleFileClick = async (filePath: string) => {
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
      setActiveCodeViewer({ path: filePath, content: fullContent });
    } catch (err: any) {
      alert(`Could not fetch file contents: ${err.message}`);
    }
  };

  // Loading UI screen
  if (!repo) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-background">
        <RefreshCw className="w-8 h-8 text-primary animate-spin mb-4" />
        <p className="text-sm text-muted-foreground">Loading repository...</p>
      </div>
    );
  }

  // Pending / Indexing UI progress screen
  if (repo.index_status !== 'ready') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-background max-w-md mx-auto text-center">
        {repo.index_status === 'failed' ? (
          <>
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4 border border-destructive/20">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Indexing Failed</h3>
            <p className="text-sm text-muted-foreground mb-6">
              {repo.metadata?.error_message || 'An error occurred during repository ingestion.'}
            </p>
            <Button onClick={() => router.push('/dashboard')} variant="outline">
              Back to Dashboard
            </Button>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 animate-pulse">
              <RefreshCw className="w-6 h-6 text-primary animate-spin" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Ingesting Codebase</h3>
            <p className="text-xs text-muted-foreground mb-6 font-mono">{repo.owner}/{repo.name}</p>
            
            <Progress value={indexingProgress} className="h-2 w-full mb-3" />
            <p className="text-xs text-muted-foreground italic mb-8">{statusMessage}</p>

            <Button onClick={() => router.push('/dashboard')} variant="ghost" size="sm">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Return to Dashboard
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-[280px_1fr] h-full overflow-hidden bg-background">
      {/* File Explorer Panel */}
      <div className="hidden lg:block h-full">
        <FileExplorer files={files} onFileClick={handleFileClick} />
      </div>

      {/* Main Chat and control area */}
      <div className="flex flex-col h-full overflow-hidden">
        {/* Top Control Bar */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-card/25">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
            </Link>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-sm font-semibold truncate max-w-[200px] font-mono">
              {repo.owner}/{repo.name}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <ProviderSelector
              provider={provider}
              setProvider={setProvider}
              apiKey={apiKey}
              setApiKey={setApiKey}
              plan={plan}
            />
          </div>
        </header>

        {/* Chat Message List */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <MessageList
            messages={uiMessagesForList}
            onStarterClick={handleStarterQuestion}
            isLoading={isLoading}
            onCitationClick={(chunk) => setActiveCitation(chunk)}
          />
        </div>

        {/* Input Bar */}
        <div className="px-6 py-4 border-t border-border bg-background">
          <ChatInput
            onSubmit={handleChatSubmit}
            isLoading={isLoading}
            disabled={!apiKey}
          />
        </div>
      </div>

      {/* Code Viewer Modal */}
      <Dialog open={activeCodeViewer !== null} onOpenChange={(open) => !open && setActiveCodeViewer(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-card border border-border">
          {activeCodeViewer && (
            <>
              <DialogHeader className="p-4 border-b border-border bg-muted/40">
                <DialogTitle className="font-mono text-sm flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-emerald-400" />
                  {activeCodeViewer.path}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Full stiched file contents fetched directly from DB.
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-auto p-4 bg-muted/10 font-mono text-xs leading-relaxed whitespace-pre-wrap select-all">
                {activeCodeViewer.content}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Citation Snippet Modal */}
      <Dialog open={activeCitation !== null} onOpenChange={(open) => !open && setActiveCitation(null)}>
        <DialogContent className="max-w-3xl max-h-[70vh] flex flex-col p-0 overflow-hidden bg-card border border-border">
          {activeCitation && (
            <>
              <DialogHeader className="p-4 border-b border-border bg-muted/40">
                <DialogTitle className="font-mono text-sm flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-primary" />
                  {activeCitation.file_path}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  RAG Cosine Match Chunk Source.
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-auto p-4 bg-muted/10 font-mono text-xs leading-relaxed whitespace-pre-wrap select-all">
                {activeCitation.content}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
export const dynamic = 'force-dynamic';
