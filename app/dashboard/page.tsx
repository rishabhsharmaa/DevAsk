'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useAuth } from '@clerk/nextjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Github, FolderPlus, CreditCard, Sparkles, AlertTriangle, ShieldCheck, Check } from 'lucide-react';
import { supabase, setBrowserTokenGetter } from '@/lib/supabase/client';
import { RepoCard } from '@/components/repo-card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Repo, Plan, CheckoutResponse } from '@/types';

// Razorpay popup checkout (loaded via script tag at runtime)
interface RazorpayCheckoutResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayCheckoutOptions {
  key?: string;
  amount?: number;
  currency?: string;
  name: string;
  description: string;
  order_id?: string;
  handler: (response: RazorpayCheckoutResponse) => void;
  theme: { color: string };
}

interface RazorpayInstance {
  open(): void;
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayCheckoutOptions) => RazorpayInstance;
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useUser();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  // Register the Clerk JWT getter before any query fires (runs first on mount).
  useEffect(() => {
    setBrowserTokenGetter(getToken);
  }, [getToken]);

  // Dialog state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Payment upgrade state
  const [isUpgrading, setIsUpgrading] = useState(false);

  // Load User details and subscription plan
  const { data: userRow, refetch: refetchUser } = useQuery({
    queryKey: ['user-plan', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  const plan = (userRow?.plan || 'free') as Plan;

  // React Query: Fetch indexed repositories
  const { data: repos, isLoading: isReposLoading, error: reposError } = useQuery<Repo[]>({
    queryKey: ['repos', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('repos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as Repo[];
    },
    enabled: !!user?.id,
  });

  // Mutator: Index a new repository
  const addRepoMutation = useMutation({
    mutationFn: async (url: string) => {
      const res = await fetch('/api/repo/index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to index repository');
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['repos'] });
      setIsAddOpen(false);
      setRepoUrl('');
      setErrorMsg('');
      router.push(`/repo/${data.repo_id}`);
    },
    onError: (err) => {
      setErrorMsg(err.message || 'Verification failed. Make sure the URL exists.');
    },
  });

  // Action: Add new repo submit handler
  const handleAddRepo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim()) return;
    addRepoMutation.mutate(repoUrl.trim());
  };

  // Action: Trigger re-index
  const handleReindex = async (repo: Repo) => {
    try {
      const res = await fetch('/api/repo/index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: repo.url }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      queryClient.invalidateQueries({ queryKey: ['repos'] });
    } catch (err) {
      alert(`Reindexing failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Action: Delete repo from DB (cascade deletes chunks and history)
  const handleDelete = async (repoId: string) => {
    if (!confirm('Are you sure you want to delete this repository and its conversation history? This cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('repos')
        .delete()
        .eq('id', repoId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['repos'] });
    } catch (err) {
      alert(`Failed to delete repo: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Action: Open hosted Stripe page or load Razorpay script
  const handleUpgrade = async () => {
    setIsUpgrading(true);
    try {
      const res = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data: CheckoutResponse = await res.json();

      if (data.provider === 'stripe' && data.checkout_url) {
        // Redirect to Stripe checkout page
        window.location.href = data.checkout_url;
      } else if (data.provider === 'razorpay') {
        // Load razorpay script first
        const loadScript = () => {
          return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
          });
        };

        const loaded = await loadScript();
        if (!loaded) {
          throw new Error('Failed to load Razorpay popup interface.');
        }

        const options = {
          key: data.razorpay_key,
          amount: data.amount,
          currency: data.currency,
          name: 'DevAsk Pro',
          description: 'Unlimited codebase indexing subscription',
          order_id: data.order_id,
          handler: async function (response: RazorpayCheckoutResponse) {
            // Call verify API
            const verifyRes = await fetch('/api/payments/razorpay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            if (verifyRes.ok) {
              refetchUser();
              alert('Successfully upgraded to Pro! Welcome aboard.');
            } else {
              alert('Signature verification failed. Please contact support.');
            }
          },
          theme: {
            color: '#7C3AED',
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
      }
    } catch (err) {
      alert(`Checkout failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsUpgrading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Welcome Banner */}
      <section className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 rounded-xl border border-border bg-card/45 backdrop-blur-sm shadow-sm">
        <div className="space-y-1">
          <h2 className="text-xl font-bold flex items-center gap-2">
            Hey, {user?.firstName || 'Developer'}! <Sparkles className="w-5 h-5 text-primary" />
          </h2>
          <p className="text-sm text-muted-foreground">
            Index repositories to get immediate answers, documentation, and citations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className="px-3 py-1 bg-background capitalize">
            Plan: {plan}
          </Badge>
          {plan === 'free' && (
            <Button
              onClick={handleUpgrade}
              disabled={isUpgrading}
              size="sm"
              className="bg-primary hover:bg-primary/80 text-primary-foreground flex items-center gap-1.5 shadow-sm glow-violet-sm"
            >
              <CreditCard className="w-4 h-4" />
              {isUpgrading ? 'Loading checkout...' : 'Upgrade to Pro'}
            </Button>
          )}
        </div>
      </section>

      {/* Query failure banner (e.g. Supabase auth misconfigured) */}
      {reposError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            Failed to load repositories: {(reposError as Error).message}. If this
            persists, check that Supabase trusts your Clerk JWTs (Authentication → Third-Party Auth).
          </span>
        </div>
      )}

      {/* Main Action Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold">Indexed Repositories</h3>
          <p className="text-xs text-muted-foreground">
            Select an indexed repository to initiate codebase chat.
          </p>
        </div>

        {/* Add Repo Dialog */}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/80 text-primary-foreground flex items-center gap-1.5 shadow-sm">
              <Plus className="w-4 h-4" /> Add Repository
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md bg-card border border-border">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-primary" /> Index Repository
              </DialogTitle>
              <DialogDescription className="text-xs">
                Paste a public or private GitHub repository URL. Private repositories require you to have linked your GitHub account via Clerk.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleAddRepo} className="space-y-4 mt-3">
              <div className="space-y-1.5">
                <Label htmlFor="repo-url-input">GitHub Repository URL</Label>
                <div className="relative">
                  <Github className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="repo-url-input"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder="https://github.com/owner/repository"
                    disabled={addRepoMutation.isPending}
                    className="pl-9 bg-background h-10"
                  />
                </div>
                {errorMsg && (
                  <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    {errorMsg}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-medium bg-emerald-500/10 px-2.5 py-1.5 rounded-lg border border-emerald-500/10">
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>RAG analysis may take up to a minute depending on repo size.</span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsAddOpen(false)}
                  disabled={addRepoMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!repoUrl.trim() || addRepoMutation.isPending}
                  className="bg-primary hover:bg-primary/80"
                >
                  {addRepoMutation.isPending ? 'Indexing...' : 'Index Codebase'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Grid List of Repos */}
      {isReposLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 rounded-xl border border-border bg-card/45 animate-pulse" />
          ))}
        </div>
      ) : repos && repos.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {repos.map((repo) => (
            <RepoCard
              key={repo.id}
              repo={repo}
              onReindex={() => handleReindex(repo)}
              onDelete={() => handleDelete(repo.id)}
            />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-border bg-card/20 max-w-xl mx-auto">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Github className="w-6 h-6 text-primary" />
          </div>
          <h4 className="text-base font-bold mb-1">No repositories indexed yet</h4>
          <p className="text-xs text-muted-foreground max-w-xs mb-6">
            Paste a public or private GitHub repository URL to initiate semantic search analysis.
          </p>
          <Button
            onClick={() => setIsAddOpen(true)}
            className="bg-primary hover:bg-primary/80 text-primary-foreground flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Index First Repository
          </Button>
        </div>
      )}
    </div>
  );
}
