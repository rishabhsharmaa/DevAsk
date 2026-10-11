import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase/service';
import { parseGitHubUrl, createOctokitClient, fetchAllFiles, detectLanguage } from '@/lib/github/client';
import { chunkFiles } from '@/lib/rag/chunker';
import {
  generateEmbeddings,
  getActiveDimension,
  getActiveModelName,
} from '@/lib/rag/embedder';
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

    // Record the file count immediately so status polling shows real
    // progress while embeddings (the slow phase) are still running.
    await supabaseAdmin
      .from('repos')
      .update({
        language: primaryLanguage,
        metadata: { file_count: files.length },
      })
      .eq('id', repoId);

    // 3. Drop minified blobs the tree filter can't see (no .min.js name,
    // but thousands of chars per line). Each would burn dozens of batches.
    const indexable = files.filter((file) => {
      const lines = file.content.split('\n').length;
      const avgLine = file.content.length / Math.max(lines, 1);
      if (file.content.length > 20_000 && avgLine > 2_000) {
        console.info(`Skipping minified file during index: ${file.path}`);
        return false;
      }
      return true;
    });

    // 4. Chunk files
    const chunks = chunkFiles(indexable);

    // Record the total upfront so status polling can show N / total.
    await supabaseAdmin
      .from('repos')
      .update({
        metadata: { file_count: files.length, total_chunks: chunks.length },
      })
      .eq('id', repoId);

    if (chunks.length === 0) {
      throw new Error('No indexable files found in this repository.');
    }

    // 5. Generate embeddings with the active provider (local by default),
    // persisting each batch as it completes so chunk progress is live in
    // the status API.
    const chunkContents = chunks.map((c) => c.content);
    await generateEmbeddings(
      chunkContents,
      undefined,
      async ({ embeddings: batchEmbeddings, startIndex }) => {
        const rows = batchEmbeddings.map((embedding, j) => {
          const chunk = chunks[startIndex + j];
          return {
            repo_id: repoId,
            file_path: chunk.file_path,
            content: chunk.content,
            embedding,
          };
        });
        // Small files pack densely, so one embedding batch can hold
        // hundreds of rows — insert in slices of 100 to stay safe.
        for (let i = 0; i < rows.length; i += 100) {
          const { error: chunkError } = await supabaseAdmin
            .from('chunks')
            .insert(rows.slice(i, i + 100));

          if (chunkError) throw chunkError;
        }
      }
    );

    // 6. Update repo as ready with metadata. The embedding stamp records
    // which vector space this index lives in — chat refuses to query it
    // with a different provider/model (see the guard in app/api/chat).
    await supabaseAdmin
      .from('repos')
      .update({
        index_status: 'ready',
        language: primaryLanguage,
        metadata: {
          file_count: files.length,
          total_chunks: chunks.length,
          primary_language: primaryLanguage || 'Unknown',
          embedding_model: getActiveModelName(),
          embedding_dimensions: getActiveDimension(),
        },
      })
      .eq('id', repoId);

  } catch (error) {
    console.error(`Failed to index repo ${repoId}:`, error);

    // Set status to 'failed' in DB
    await supabaseAdmin
      .from('repos')
      .update({
        index_status: 'failed',
        metadata: {
          error_message:
            error instanceof Error ? error.message : 'Unknown error during indexing',
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
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'Invalid GitHub URL' },
        { status: 400 }
      );
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
      const { error: createError } = await supabaseAdmin
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
  } catch (error) {
    console.error('API index repo error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
