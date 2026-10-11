import { NextRequest, NextResponse, after } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase/service';
import { retrieveRelevantChunks, buildContextPrompt } from '@/lib/rag/retriever';
import { getActiveModelName } from '@/lib/rag/embedder';
import { streamChat } from '@/lib/llm';
import { extractLastUserText } from '@/lib/llm/extract-user-text';
import type { RepoMetadata } from '@/types';
import type { ModelMessage } from 'ai';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const { repo_id, conversation_id, message, messages: clientMessages, provider, api_key } = body;

    // DefaultChatTransport posts the conversation as `messages[]` (UIMessage
    // with parts); direct API callers may send top-level `message` instead.
    const userText =
      typeof message === 'string' && message.trim().length > 0
        ? message.trim()
        : extractLastUserText(clientMessages);

    const missing: string[] = [];
    if (!repo_id) missing.push('repo_id');
    if (!userText) missing.push('message text');
    if (!provider) missing.push('provider');
    if (!api_key) missing.push('api_key');
    if (!repo_id || !userText || !provider || !api_key) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(', ')}.` },
        { status: 400 }
      );
    }

    // All providers are available to everyone — validate the value only.
    if (provider !== 'openai' && provider !== 'anthropic' && provider !== 'gemini') {
      return NextResponse.json(
        { error: `Unsupported provider: ${provider}. Expected openai, anthropic, or gemini.` },
        { status: 400 }
      );
    }

    // 1. Fetch repo details to ensure ownership + get name for system prompt
    const { data: repo, error: repoError } = await supabaseAdmin
      .from('repos')
      .select('*')
      .eq('id', repo_id)
      .eq('user_id', userId)
      .single();

    if (repoError || !repo) {
      return NextResponse.json({ error: 'Repository not found or unauthorized.' }, { status: 404 });
    }

    // Refuse to query an index built by a different embedding model —
    // vectors from different providers live in different vector spaces,
    // so cross-model retrieval would return nonsense. Unstamped (legacy)
    // indexes are allowed through; the 002 migration wiped their vectors.
    const repoModel = (repo.metadata as RepoMetadata | null)?.embedding_model;
    const activeModel = getActiveModelName();
    if (repoModel && repoModel !== activeModel) {
      return NextResponse.json(
        {
          error:
            `This repository was indexed with "${repoModel}" but the server is ` +
            `running "${activeModel}". Delete the repo and re-add it to re-index ` +
            `with the current embedding model.`,
        },
        { status: 409 }
      );
    }

    // 2. Handle conversation creation/retrieval
    let conversationId = conversation_id;
    if (!conversationId) {
      const { data: newConv, error: convError } = await supabaseAdmin
        .from('conversations')
        .insert({
          repo_id,
          user_id: userId,
        })
        .select()
        .single();

      if (convError || !newConv) {
        return NextResponse.json({ error: 'Failed to create conversation.' }, { status: 500 });
      }
      conversationId = newConv.id;
    }

    // 3. Retrieve context chunks from vector store
    const chunks = await retrieveRelevantChunks(repo_id, userText, 10);

    // 4. Fetch recent messages for conversation history
    const { data: dbMessages, error: msgError } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(5); // last 5 messages for context

    if (msgError) {
      return NextResponse.json({ error: 'Failed to fetch conversation history.' }, { status: 500 });
    }

    // Convert DB messages to CoreMessage[] for AI SDK
    const history: ModelMessage[] = (dbMessages || []).map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    // Construct system prompt with chunks
    const systemPrompt = buildContextPrompt(chunks, repo.name);

    // Append current user message
    const coreMessages: ModelMessage[] = [
      ...history,
      { role: 'user', content: userText },
    ];

    // 5. Save current user message to DB
    const { error: userInsertError } = await supabaseAdmin.from('messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: userText,
    });

    if (userInsertError) {
      console.error('Failed to save user message:', userInsertError);
    }

    // 6. Stream the response from the LLM
    const result = await streamChat(
      { provider, api_key },
      coreMessages,
      systemPrompt
    );

    // 7. Persist the assistant message once streaming completes. This runs
    // inside `after()` for the same reason as indexing: a floating promise
    // is frozen when the response ends on serverless (Vercel), silently
    // losing the saved reply. Awaiting inside the callback keeps it alive.
    const sourceChunksJson = chunks.map((chunk) => ({
      file_path: chunk.file_path,
      content: chunk.content,
      similarity: chunk.similarity,
    }));

    after(async () => {
      try {
        const fullText = await result.text;
        await supabaseAdmin.from('messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: fullText,
          source_chunks: sourceChunksJson,
        });
      } catch (err) {
        console.error('Error saving assistant message to DB:', err);
      }
    });

    // Return the stream response with custom headers for client correlation
    const response = result.toUIMessageStreamResponse();
    response.headers.set('x-conversation-id', conversationId);
    
    return response;
  } catch (error) {
    console.error('API chat error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
