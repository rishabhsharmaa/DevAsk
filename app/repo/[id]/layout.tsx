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
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {children}
      </div>
    </Providers>
  );
}
export const dynamic = 'force-dynamic';
