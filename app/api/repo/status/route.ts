import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase/service';

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const repoId = searchParams.get('repo_id');

    if (!repoId) {
      return NextResponse.json({ error: 'repo_id parameter is required.' }, { status: 400 });
    }

    // 1. Fetch repo details
    const { data: repo, error: repoError } = await supabaseAdmin
      .from('repos')
      .select('*')
      .eq('id', repoId)
      .eq('user_id', userId)
      .single();

    if (repoError || !repo) {
      return NextResponse.json({ error: 'Repository not found or unauthorized.' }, { status: 404 });
    }

    // 2. Fetch chunk count
    const { count, error: countError } = await supabaseAdmin
      .from('chunks')
      .select('*', { count: 'exact', head: true })
      .eq('repo_id', repoId);

    if (countError) {
      return NextResponse.json({ error: 'Failed to retrieve chunk count.' }, { status: 500 });
    }

    return NextResponse.json({
      index_status: repo.index_status,
      file_count: repo.metadata?.file_count || 0,
      chunk_count: count || 0,
      metadata: repo.metadata || null,
    });
  } catch (error: any) {
    console.error('API repo status error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
