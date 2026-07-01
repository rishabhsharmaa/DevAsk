'use client';

import React from 'react';
import Link from 'next/link';
import { GitBranch, RefreshCw, Trash2, MessageSquare, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Repo } from '@/types';

interface RepoCardProps {
  repo: Repo;
  onReindex: () => void;
  onDelete: () => void;
}

export function RepoCard({ repo, onReindex, onDelete }: RepoCardProps) {
  const isReady = repo.index_status === 'ready';
  const isIndexing = repo.index_status === 'indexing';
  const isFailed = repo.index_status === 'failed';
  const isPending = repo.index_status === 'pending';

  // Status styling
  const getStatusBadge = () => {
    switch (repo.index_status) {
      case 'ready':
        return (
          <Badge variant="outline" className="flex items-center gap-1 text-emerald-400 border-emerald-500/20 bg-emerald-500/5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Ready
          </Badge>
        );
      case 'indexing':
        return (
          <Badge variant="outline" className="flex items-center gap-1 text-blue-400 border-blue-500/20 bg-blue-500/5 animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Indexing
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="outline" className="flex items-center gap-1 text-destructive border-destructive/20 bg-destructive/5">
            <AlertCircle className="w-3.5 h-3.5" /> Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="flex items-center gap-1 text-yellow-400 border-yellow-500/20 bg-yellow-500/5 animate-pulse">
            <Clock className="w-3.5 h-3.5" /> Pending
          </Badge>
        );
    }
  };

  return (
    <Card className="group flex flex-col justify-between overflow-hidden border border-border bg-card/50 hover:bg-card hover:border-primary/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5">
      <CardHeader className="p-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 truncate">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <GitBranch className="w-4.5 h-4.5 text-primary" />
            </div>
            <div className="truncate">
              <CardTitle className="text-sm font-semibold truncate hover:text-primary transition-colors">
                {repo.name}
              </CardTitle>
              <CardDescription className="text-xs truncate">
                {repo.owner}
              </CardDescription>
            </div>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>

      <CardContent className="px-5 pb-3 flex-1 flex flex-col gap-3">
        {/* Repo metadata */}
        <div className="flex flex-wrap items-center gap-2">
          {repo.language && (
            <Badge variant="secondary" className="text-[10px] py-0 px-2 font-mono">
              {repo.language}
            </Badge>
          )}
          {repo.metadata?.file_count != null && (
            <span className="text-[10px] text-muted-foreground font-mono">
              {repo.metadata.file_count} files
            </span>
          )}
          {repo.metadata?.total_chunks != null && (
            <span className="text-[10px] text-muted-foreground font-mono">
              {repo.metadata.total_chunks} chunks
            </span>
          )}
        </div>

        {/* Short Summary description if exists */}
        {repo.metadata?.summary ? (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {repo.metadata.summary}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground/60 italic">
            {isIndexing ? 'Analysing codebase architecture...' : 'No summary generated yet.'}
          </p>
        )}
      </CardContent>

      <CardFooter className="px-5 py-4 border-t border-border/40 bg-muted/20 flex items-center justify-between gap-2">
        <div className="flex gap-1.5">
          <Button
            size="icon-sm"
            variant="outline"
            onClick={onReindex}
            disabled={isIndexing}
            title="Re-index Repository"
            className="hover:text-primary"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isIndexing && "animate-spin")} />
          </Button>
          <Button
            size="icon-sm"
            variant="destructive"
            onClick={onDelete}
            title="Delete Repository"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>

        <Link
          href={isReady ? `/repo/${repo.id}` : '#'}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
            isReady
              ? "bg-primary text-primary-foreground hover:bg-primary/80"
              : "bg-muted text-muted-foreground pointer-events-none"
          )}
        >
          <MessageSquare className="w-3.5 h-3.5" /> Chat
        </Link>
      </CardFooter>
    </Card>
  );
}
export default RepoCard;
