import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase/service';
import { retrieveRelevantChunks, buildContextPrompt } from '@/lib/rag/retriever';
import { streamChat } from '@/lib/llm';
import { PLAN_LIMITS } from '@/types';
import type { ModelMessage } from 'ai';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const { repo_id, conversation_id, message, provider, api_key } = body;

    if (!repo_id || !message || !provider || !api_key) {
      return NextResponse.json(
        { error: 'repo_id, message, provider, and api_key are required.' },
        { status: 400 }
      );
    }

    // 1. Get user and verify plan limits
    const { data: userRow, error: userError } = await supabaseAdmin
      .from('users')
      .select('plan')
      .eq('id', userId)
      .single();

    const plan = userRow?.plan || 'free';
    const limits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS];

    if (!limits.providers.includes(provider)) {
      return NextResponse.json(
        { error: `The ${provider} provider is only available on Pro plans. Please upgrade.` },
        { status: 403 }
      );
    }

    // 2. Fetch repo details to ensure ownership + get name for system prompt
    const { data: repo, error: repoError } = await supabaseAdmin
      .from('repos')
      .select('*')
      .eq('id', repo_id)
      .eq('user_id', userId)
      .single();

    if (repoError || !repo) {
      return NextResponse.json({ error: 'Repository not found or unauthorized.' }, { status: 404 });
    }

    // 3. Handle conversation creation/retrieval
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

    // 4. Retrieve context chunks from vector store
    const chunks = await retrieveRelevantChunks(repo_id, message, 10);

    // 5. Fetch recent messages for conversation history
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
      { role: 'user', content: message },
    ];

    // 6. Save current user message to DB
    const { error: userInsertError } = await supabaseAdmin.from('messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: message,
    });

    if (userInsertError) {
      console.error('Failed to save user message:', userInsertError);
    }

    // 7. Stream the response from the LLM
    const result = await streamChat(
      { provider, api_key },
      coreMessages,
      systemPrompt
    );

    // 8. Fire-and-forget: Persist assistant message when streaming completes
    const sourceChunksJson = chunks.map((chunk) => ({
      file_path: chunk.file_path,
      content: chunk.content,
      similarity: chunk.similarity,
    }));

    result.text
      .then(
        async (fullText) => {
          await supabaseAdmin.from('messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: fullText,
            source_chunks: sourceChunksJson,
          });
        },
        (err) => {
          console.error('Error saving assistant message to DB:', err);
        }
      );

    // Return the stream response with custom headers for client correlation
    const response = result.toUIMessageStreamResponse();
    response.headers.set('x-conversation-id', conversationId);
    
    return response;
  } catch (error: any) {
    console.error('API chat error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
