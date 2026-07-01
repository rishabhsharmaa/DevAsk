import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { UserButton } from '@clerk/nextjs';
import { Code2, LayoutDashboard, CreditCard, ShieldAlert } from 'lucide-react';
import { Providers } from '@/components/providers';

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
      <div className="flex flex-col min-h-screen bg-background">
        {/* Header Navbar */}
        <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
          <div className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto w-full">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Code2 className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-semibold tracking-tight">DevAsk</span>
            </Link>

            <div className="flex items-center gap-6">
              <nav className="flex items-center gap-4 text-sm font-medium">
                <Link
                  href="/dashboard"
                  className="flex items-center gap-1.5 text-foreground hover:text-primary transition-colors"
                >
                  <LayoutDashboard className="w-4 h-4" /> Dashboard
                </Link>
              </nav>

              <div className="flex items-center gap-2 border-l border-border pl-6">
                <UserButton
                  appearance={{
                    elements: {
                      userButtonAvatarBox: 'w-8 h-8 border border-border',
                    },
                  }}
                />
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Main Viewport */}
        <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
          {children}
        </main>
      </div>
    </Providers>
  );
}
export const dynamic = 'force-dynamic';
