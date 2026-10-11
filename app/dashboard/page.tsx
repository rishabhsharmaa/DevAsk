'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser, useAuth } from '@clerk/nextjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Github,
  FolderGit2,
  RefreshCw,
  Trash2,
  MessageSquareText,
} from 'lucide-react';
import { supabase, setBrowserTokenGetter } from '@/lib/supabase/client';
import { StatusBadge } from '@/components/status';
import { EmptyState, InlineError, FieldError } from '@/components/state';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Repo } from '@/types';

const GITHUB_URL_RE =
  /^https?:\/\/(www\.)?github\.com\/([^/\s]+)\/([^/\s#?]+)(\/)?(\?.*)?$/;

function parseGitHubUrl(url: string): { owner: string; name: string } | null {
  const match = url.trim().match(GITHUB_URL_RE);
  if (!match) return null;
  const name = match[3].replace(/\.git$/, '');
  if (!match[2] || !name) return null;
  return { owner: match[2], name };
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
  const [urlError, setUrlError] = useState('');
  const [repoToDelete, setRepoToDelete] = useState<Repo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Inline (non-blocking) notices — no alert()/confirm() anywhere.
  const [actionError, setActionError] = useState<string | null>(null);

  // React Query: Fetch indexed repositories
  const { data: repos, isLoading: isReposLoading, error: reposError, refetch: refetchRepos } = useQuery<Repo[]>({
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

  const repoCount = repos?.length ?? 0;
  const parsedPreview = parseGitHubUrl(repoUrl);

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
      setUrlError('');
      router.push(`/repo/${data.repo_id}`);
    },
    onError: (err) => {
      setUrlError(err.message || 'Verification failed. Make sure the URL exists and is accessible.');
    },
  });

  // Action: Add new repo submit handler
  const handleAddRepo = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = repoUrl.trim();
    if (!trimmed || addRepoMutation.isPending) return;
    if (!parseGitHubUrl(trimmed)) {
      setUrlError('Enter a valid GitHub repository URL, e.g. https://github.com/owner/repo');
      return;
    }
    setUrlError('');
    setActionError(null);
    addRepoMutation.mutate(trimmed);
  };

  // Action: Trigger re-index
  const handleReindex = async (repo: Repo) => {
    setActionError(null);
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
      setActionError(`Reindexing failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Action: Delete repo from DB (cascade deletes chunks and history)
  const handleDeleteConfirm = async () => {
    if (!repoToDelete) return;
    setIsDeleting(true);
    setActionError(null);
    try {
      const { error } = await supabase
        .from('repos')
        .delete()
        .eq('id', repoToDelete.id);

      if (error) throw error;

      setRepoToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['repos'] });
    } catch (err) {
      setActionError(`Failed to delete repository: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Workspace header: what exists, what it costs, what to do next */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Repositories</h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {isReposLoading ? (
              'loading workspace…'
            ) : (
              <>
                {repoCount} {repoCount === 1 ? 'repository' : 'repositories'}
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setIsAddOpen(true)} className="gap-1.5 font-semibold">
            <Plus className="h-4 w-4" />
            Add repository
          </Button>
        </div>
      </div>

      {actionError && (
        <InlineError title="Something went wrong" body={actionError} />
      )}

      {/* Query failure banner (e.g. Supabase auth misconfigured) */}
      {reposError && (
        <InlineError
          title="Couldn't load repositories"
          body={`${(reposError as Error).message} — if this persists, check that Supabase trusts your Clerk JWTs (Authentication → Third-Party Auth).`}
          action={{ label: 'Try again', onClick: () => refetchRepos() }}
        />
      )}

      {/* Repository ledger */}
      {isReposLoading ? (
        <div className="border border-border" aria-label="Loading repositories">
          {[0, 1, 2].map((i) => (
            <div key={i} className={cn('animate-pulse px-4 py-4', i > 0 && 'border-t border-border')}>
              <div className="flex items-center gap-3">
                <div className="h-4 w-40 bg-muted" />
                <div className="h-4 w-14 bg-muted" />
              </div>
              <div className="mt-2.5 flex items-center gap-3">
                <div className="h-3 w-24 bg-muted/70" />
                <div className="h-3 w-16 bg-muted/70" />
                <div className="h-3 w-20 bg-muted/70" />
              </div>
            </div>
          ))}
        </div>
      ) : repos && repos.length > 0 ? (
        <div className="border border-border">
          <div className="hidden grid-cols-[minmax(0,1fr)_110px_90px_64px_112px_156px] items-center gap-4 border-b border-border bg-card px-4 py-2 font-mono text-[11px] tracking-wide text-muted-foreground uppercase lg:grid">
            <span>Repository</span>
            <span>Status</span>
            <span>Language</span>
            <span className="text-right tabular">Files</span>
            <span className="text-right tabular">Indexed</span>
            <span className="text-right">Actions</span>
          </div>
          {repos.map((repo, i) => (
            <RepoRow
              key={repo.id}
              repo={repo}
              bordered={i > 0}
              onReindex={() => handleReindex(repo)}
              onDelete={() => setRepoToDelete(repo)}
            />
          ))}
        </div>
      ) : (
        !reposError && (
          <EmptyState
            icon={<FolderGit2 className="h-4 w-4" />}
            title="No codebase connected yet"
            body="Connect a GitHub repository to start asking questions about its architecture, implementation, and dependencies."
            primary={{ label: 'Add repository', onClick: () => setIsAddOpen(true) }}
            secondary={{ label: 'See how it works', href: '/#product' }}
          />
        )
      )}

      {/* Add repository dialog */}
      <Dialog
        open={isAddOpen}
        onOpenChange={(open) => {
          setIsAddOpen(open);
          if (!open) {
            setUrlError('');
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Index a repository</DialogTitle>
            <DialogDescription>
              Paste a GitHub URL. DevAsk crawls the full tree and builds a
              searchable index — usually within a minute.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddRepo} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="repo-url-input">GitHub repository URL</Label>
              <div className="relative">
                <Github className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="repo-url-input"
                  value={repoUrl}
                  onChange={(e) => {
                    setRepoUrl(e.target.value);
                    if (urlError) setUrlError('');
                  }}
                  placeholder="https://github.com/owner/repository"
                  disabled={addRepoMutation.isPending}
                  className="h-10 pr-3 pl-9 font-mono text-[13px]"
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={urlError ? true : undefined}
                  aria-describedby={urlError ? 'repo-url-error' : undefined}
                />
              </div>
              {parsedPreview && !urlError && (
                <p className="font-mono text-xs text-muted-foreground" aria-live="polite">
                  will index <span className="text-foreground">{parsedPreview.owner}/{parsedPreview.name}</span>
                </p>
              )}
              <div id="repo-url-error">{urlError && <FieldError message={urlError} />}</div>
            </div>

            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Public repositories work out of the box. Private repositories
              work when the server GitHub token can read them.
            </p>

            <DialogFooter>
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
              >
                {addRepoMutation.isPending ? 'Starting index…' : 'Index codebase'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={repoToDelete !== null} onOpenChange={(open) => !open && !isDeleting && setRepoToDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this repository?</DialogTitle>
            <DialogDescription>
              {repoToDelete && (
                <>
                  <span className="font-mono text-[13px] text-foreground">
                    {repoToDelete.owner}/{repoToDelete.name}
                  </span>{' '}
                  and its index plus conversation history will be permanently removed.
                  This cannot be undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRepoToDelete(null)} disabled={isDeleting}>
              Keep it
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={isDeleting}>
              {isDeleting ? 'Deleting…' : 'Delete repository'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RepoRow({
  repo,
  bordered,
  onReindex,
  onDelete,
}: {
  repo: Repo;
  bordered: boolean;
  onReindex: () => void;
  onDelete: () => void;
}) {
  const isReady = repo.index_status === 'ready';
  const isIndexing = repo.index_status === 'indexing' || repo.index_status === 'pending';

  return (
    <div
      className={cn(
        'grid gap-2 px-4 py-3.5 transition-colors hover:bg-card/60 lg:grid-cols-[minmax(0,1fr)_110px_90px_64px_112px_156px] lg:items-center lg:gap-4',
        bordered && 'border-t border-border'
      )}
    >
      {/* Repository identity */}
      <div className="min-w-0">
        {isReady ? (
          <Link
            href={`/repo/${repo.id}`}
            className="truncate font-mono text-[13.5px] font-medium hover:underline hover:decoration-signal hover:underline-offset-4"
          >
            {repo.owner}/{repo.name}
          </Link>
        ) : (
          <p className="truncate font-mono text-[13.5px] font-medium text-muted-foreground">
            {repo.owner}/{repo.name}
          </p>
        )}
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {repo.metadata?.summary ?? (isIndexing ? 'Indexing in progress…' : 'No summary yet.')}
        </p>
      </div>

      {/* Status */}
      <div className="max-lg:mt-1">
        <StatusBadge status={repo.index_status} />
      </div>

      {/* Language */}
      <div className="font-mono text-xs text-muted-foreground max-lg:hidden">
        {repo.language ?? '—'}
      </div>

      {/* Counts */}
      <div className="font-mono text-xs text-muted-foreground tabular max-lg:hidden lg:text-right">
        {repo.metadata?.file_count != null ? repo.metadata.file_count.toLocaleString() : '—'}
      </div>
      <div className="font-mono text-xs whitespace-nowrap text-muted-foreground tabular max-lg:hidden lg:text-right">
        {shortDate(repo.created_at)}
      </div>

      {/* Compact meta for small screens */}
      <p className="font-mono text-[11.5px] text-muted-foreground lg:hidden">
        {[repo.language, repo.metadata?.file_count != null ? `${repo.metadata.file_count} files` : null, shortDate(repo.created_at)]
          .filter(Boolean)
          .join(' · ')}
      </p>

      {/* Actions */}
      <div className="flex items-center gap-1.5 max-lg:mt-1 lg:justify-end">
        {isReady ? (
          <Button size="sm" asChild className="gap-1.5 font-semibold">
            <Link href={`/repo/${repo.id}`}>
              <MessageSquareText className="h-3.5 w-3.5" />
              Open
            </Link>
          </Button>
        ) : (
          <Button size="sm" variant="outline" asChild className="gap-1.5">
            <Link href={`/repo/${repo.id}`}>
              {isIndexing ? 'Status' : 'Details'}
            </Link>
          </Button>
        )}
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={onReindex}
          disabled={isIndexing}
          title="Re-index repository"
          aria-label={`Re-index ${repo.owner}/${repo.name}`}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isIndexing && 'animate-spin')} />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={onDelete}
          title="Delete repository"
          aria-label={`Delete ${repo.owner}/${repo.name}`}
          className="hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
