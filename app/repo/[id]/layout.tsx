import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase/service';
import { Providers } from '@/components/providers';

export default async function RepoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in');
  }

  const { id } = await params;

  // Verify ownership of the repository
  const { data: repo, error: repoError } = await supabaseAdmin
    .from('repos')
    .select('user_id, name, owner')
    .eq('id', id)
    .single();

  if (repoError || !repo || repo.user_id !== userId) {
    redirect('/dashboard');
  }

  return (
    <Providers>
      {/* Viewport lock via core utility + inline style only: h-screen
          (100vh) is the fallback and inline 100dvh wins where supported.
          Inline styles ship with the HTML and can't be dropped by the CSS
          build, so this holds regardless of stylesheet behavior. */}
      <div
        className="flex h-screen min-h-0 w-full flex-1 flex-col overflow-hidden"
        style={{ height: '100dvh' }}
      >
        {children}
      </div>
    </Providers>
  );
}
export const dynamic = 'force-dynamic';
