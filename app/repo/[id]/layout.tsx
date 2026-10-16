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
      {/* Viewport lock: definite height only — NOTE: no flex-1 here.
          flex-basis % resolves to *content* (not this height) when the
          parent (body) has indefinite height, which sizes the shell to its
          content and bypasses the lock entirely. flex-none lets the height
          apply: h-screen (100vh) fallback, inline 100dvh wins where
          supported (ships with the HTML, undroppable by the CSS build). */}
      <div
        className="flex h-screen min-h-0 w-full flex-none flex-col overflow-hidden"
        style={{ height: '100dvh' }}
      >
        {children}
      </div>
    </Providers>
  );
}
export const dynamic = 'force-dynamic';
