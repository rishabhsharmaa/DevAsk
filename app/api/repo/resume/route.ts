import { NextRequest, NextResponse, after } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase/service';
import { createOctokitClient, fetchAllFiles, detectLanguage } from '@/lib/github/client';
import { chunkFiles } from '@/lib/rag/chunker';
import { selectMissingChunks } from '@/lib/rag/resume';
import {
  generateEmbeddings,
  getActiveDimension,
  getActiveModelName,
} from '@/lib/rag/embedder';
import type { RepoMetadata } from '@/types';

/**
 * Resume a stalled indexing run.
 *
 * Serverless executions die at maxDuration (60s on Vercel Hobby), freezing
 * repos mid-index with partial chunks and no error. Resume re-crawls and
 * re-chunks (deterministic and cheap — no embedding cost), diffs against
 * already-stored chunk contents, embeds only the missing ones, and either
 * advances further or marks the repo ready. Safe to call repeatedly: each
 * run advances ~one execution window.
 *
 * (Insert shape, filters, and the ready stamp mirror app/api/repo/index —
 * keep the two in sync. Concurrent resumes could duplicate rows, but the
 * UI only offers resume after 30s without progress on a run older than
 * 90s, at which point no execution can still be alive under the 60s cap.)
 */
export const maxDuration = 60;

async function resumeInBackground(
  repoId: string,
  owner: string,
  name: string,
  token: string | null
) {
  try {
    // 1. Re-crawl + re-chunk (same filters as the index route)
    const octokit = createOctokitClient(token);
    const files = await fetchAllFiles(octokit, owner, name);
    const primaryLanguage = detectLanguage(files);

    const indexable = files.filter((file) => {
      const lines = file.content.split('\n').length;
      const avgLine = file.content.length / Math.max(lines, 1);
      if (file.content.length > 20_000 && avgLine > 2_000) {
        console.info(`Skipping minified file during resume: ${file.path}`);
        return false;
      }
      return true;
    });

    const chunks = chunkFiles(indexable);
    if (chunks.length === 0) {
      throw new Error('No indexable files found in this repository.');
    }

    await supabaseAdmin
      .from('repos')
      .update({
        index_status: 'indexing',
        language: primaryLanguage,
        metadata: { file_count: files.length, total_chunks: chunks.length },
      })
      .eq('id', repoId);

    // 2. Diff against stored chunks — embed only what's missing
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('chunks')
      .select('content')
      .eq('repo_id', repoId);
    if (existingError) throw existingError;

    const missing = selectMissingChunks(
      chunks,
      (existing ?? []).map((row) => row.content)
    );

    if (missing.length === 0) {
      // Killed after the last insert but before flagging ready — repair.
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
      return;
    }

    // 3. Embed the missing chunks, persisting each batch as it completes
    const missingContents = missing.map((c) => c.content);
    await generateEmbeddings(
      missingContents,
      undefined,
      async ({ embeddings: batchEmbeddings, startIndex }) => {
        const rows = batchEmbeddings.map((embedding, j) => {
          const chunk = missing[startIndex + j];
          return {
            repo_id: repoId,
            file_path: chunk.file_path,
            content: chunk.content,
            embedding,
          };
        });
        for (let i = 0; i < rows.length; i += 100) {
          const { error: chunkError } = await supabaseAdmin
            .from('chunks')
            .insert(rows.slice(i, i + 100));

          if (chunkError) throw chunkError;
        }
      }
    );

    // 4. Mark ready with the embedding stamp (same shape as the index route)
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
    console.error(`Failed to resume repo ${repoId}:`, error);

    await supabaseAdmin
      .from('repos')
      .update({
        index_status: 'failed',
        metadata: {
          error_message:
            error instanceof Error ? error.message : 'Unknown error during resume',
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
    const { repo_id } = body;

    if (!repo_id) {
      return NextResponse.json({ error: 'repo_id is required.' }, { status: 400 });
    }

    const { data: repo, error: repoError } = await supabaseAdmin
      .from('repos')
      .select('*')
      .eq('id', repo_id)
      .eq('user_id', userId)
      .single();

    if (repoError || !repo) {
      return NextResponse.json({ error: 'Repository not found or unauthorized.' }, { status: 404 });
    }

    // Only stalled or failed runs can resume — ready rows are complete and
    // pending rows have a run that hasn't started yet (resuming would race it).
    if (repo.index_status !== 'indexing' && repo.index_status !== 'failed') {
      return NextResponse.json(
        { error: `Only repos stuck in indexing (or failed) can resume — this one is ${repo.index_status}.` },
        { status: 409 }
      );
    }

    // Same vector-space guard as chat: refuse to extend an index built by
    // a different embedding model.
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

    const { data: userRow } = await supabaseAdmin
      .from('users')
      .select('github_token')
      .eq('id', userId)
      .single();
    const gitHubToken = userRow?.github_token || null;

    after(() => resumeInBackground(repo.id, repo.owner, repo.name, gitHubToken));

    return NextResponse.json({
      repo_id: repo.id,
      status: 'indexing',
    });
  } catch (error) {
    console.error('API resume repo error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
