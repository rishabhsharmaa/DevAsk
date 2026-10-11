import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { UserButton } from '@clerk/nextjs';
import { LayoutDashboard } from 'lucide-react';
import { Providers } from '@/components/providers';
import { Brand } from '@/components/brand';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in');
  }

  return (
    <Providers>
      <div className="flex min-h-screen flex-col bg-background">
        <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-md">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
            <Link href="/" className="flex items-center" aria-label="DevAsk home">
              <Brand />
            </Link>

            <div className="flex items-center gap-4">
              <nav className="flex items-center text-[13.5px] font-medium" aria-label="Workspace">
                <Link
                  href="/dashboard"
                  className="flex items-center gap-1.5 text-foreground transition-colors hover:text-muted-foreground"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Link>
              </nav>

              <div className="border-l border-border pl-4">
                <UserButton
                  appearance={{
                    elements: {
                      userButtonAvatarBox: 'h-7 w-7 border border-border',
                    },
                  }}
                />
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
      </div>
    </Providers>
  );
}
export const dynamic = 'force-dynamic';
