import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase/service';
import { parseGitHubUrl, createOctokitClient, fetchAllFiles, detectLanguage } from '@/lib/github/client';
import { chunkFiles } from '@/lib/rag/chunker';
import { generateEmbeddings } from '@/lib/rag/embedder';
import { PLAN_LIMITS } from '@/types';

// Fire-and-forget background indexing pipeline
async function indexRepoBackground(
  repoId: string,
  userId: string,
  url: string,
  owner: string,
  name: string,
  token: string | null
) {
  try {
    // 1. Update status to 'indexing'
    await supabaseAdmin
      .from('repos')
      .update({ index_status: 'indexing' })
      .eq('id', repoId);

    // 2. Initialize GitHub client and fetch all files
    const octokit = createOctokitClient(token);
    const files = await fetchAllFiles(octokit, owner, name);
    const primaryLanguage = detectLanguage(files);

    // 3. Chunk files
    const chunks = chunkFiles(files);
    
    if (chunks.length === 0) {
      throw new Error('No indexable files found in this repository.');
    }

    // 4. Generate embeddings (using Voyage voyage-code-4)
    const chunkContents = chunks.map((c) => c.content);
    const embeddings = await generateEmbeddings(chunkContents);

    // 5. Batch insert chunks with embeddings
    const chunksToInsert = chunks.map((chunk, index) => ({
      repo_id: repoId,
      file_path: chunk.file_path,
      content: chunk.content,
      embedding: embeddings[index],
    }));

    // Insert in batches of 100 to avoid request limits/timeouts
    const BATCH_SIZE = 100;
    for (let i = 0; i < chunksToInsert.length; i += BATCH_SIZE) {
      const batch = chunksToInsert.slice(i, i + BATCH_SIZE);
      const { error: chunkError } = await supabaseAdmin
        .from('chunks')
        .insert(batch);
      
      if (chunkError) throw chunkError;
    }

    // 6. Update repo as ready with metadata
    await supabaseAdmin
      .from('repos')
      .update({
        index_status: 'ready',
        language: primaryLanguage,
        metadata: {
          file_count: files.length,
          total_chunks: chunks.length,
          primary_language: primaryLanguage || 'Unknown',
        },
      })
      .eq('id', repoId);

  } catch (error: any) {
    console.error(`Failed to index repo ${repoId}:`, error);
    
    // Set status to 'failed' in DB
    await supabaseAdmin
      .from('repos')
      .update({
        index_status: 'failed',
        metadata: {
          error_message: error.message || 'Unknown error during indexing',
        },
      })
      .eq('id', repoId);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ error: 'GitHub repository URL is required.' }, { status: 400 });
    }

    let owner: string;
    let name: string;
    try {
      const parsed = parseGitHubUrl(url);
      owner = parsed.owner;
      name = parsed.name;
    } catch (e: any) {
      return NextResponse.json({ error: e.message || 'Invalid GitHub URL' }, { status: 400 });
    }

    // Retrieve user token & subscription plan
    const { data: userRow, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    let userPlan = 'free';
    let gitHubToken: string | null = null;

    if (userError || !userRow) {
      // Create user row if not exists
      const { data: newUser, error: createError } = await supabaseAdmin
        .from('users')
        .insert({ id: userId, plan: 'free' })
        .select()
        .single();
      
      if (createError) {
        return NextResponse.json({ error: 'Failed to create user record.' }, { status: 500 });
      }
    } else {
      userPlan = userRow.plan || 'free';
      gitHubToken = userRow.github_token || null;
    }

    // Check repository limits
    const { data: existingRepos, error: reposError } = await supabaseAdmin
      .from('repos')
      .select('id')
      .eq('user_id', userId);

    if (reposError) {
      return NextResponse.json({ error: 'Failed to check repository count.' }, { status: 500 });
    }

    const limits = PLAN_LIMITS[userPlan as keyof typeof PLAN_LIMITS];
    if (existingRepos.length >= limits.max_repos) {
      return NextResponse.json(
        { error: `You have reached the maximum of ${limits.max_repos} repositories for your ${userPlan} plan. Please upgrade to Pro.` },
        { status: 403 }
      );
    }

    // Insert new repo in pending state
    const { data: newRepo, error: insertError } = await supabaseAdmin
      .from('repos')
      .insert({
        user_id: userId,
        url,
        owner,
        name,
        index_status: 'pending',
      })
      .select()
      .single();

    if (insertError || !newRepo) {
      return NextResponse.json({ error: 'Failed to initialize repository record.' }, { status: 500 });
    }

    // Trigger async background indexing (fire-and-forget)
    indexRepoBackground(newRepo.id, userId, url, owner, name, gitHubToken);

    return NextResponse.json({
      repo_id: newRepo.id,
      status: 'pending',
    });
  } catch (error: any) {
    console.error('API index repo error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
