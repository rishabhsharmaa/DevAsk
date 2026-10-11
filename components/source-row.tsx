'use client';

import { cn } from '@/lib/utils';
import type { SourceChunk } from '@/types';

interface SourceRowProps {
  /** Zero-based position in the cited list. */
  index: number;
  chunk: SourceChunk;
  onOpen?: (chunk: SourceChunk) => void;
  className?: string;
}

/**
 * One cited source as evidence: rank, filename, directory, relevance.
 * Shared by answer citations and the index panel's latest-sources list.
 */
export function SourceRow({ index, chunk, onOpen, className }: SourceRowProps) {
  const parts = chunk.file_path.split('/');
  const name = parts.pop() ?? chunk.file_path;
  const dir = parts.join('/');

  return (
    <button
      type="button"
      onClick={() => onOpen?.(chunk)}
      title={`Open source: ${chunk.file_path}`}
      className={cn(
        'flex w-full items-center gap-3 px-1 py-2 text-left transition-colors hover:bg-accent/50',
        className
      )}
    >
      <span className="w-6 flex-shrink-0 font-mono text-[11px] text-muted-foreground tabular">
        {String(index + 1).padStart(2, '0')}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-mono text-xs text-foreground/90">{name}</span>
        {dir ? (
          <span className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground">
            {dir}/
          </span>
        ) : null}
      </span>
      {chunk.similarity != null && (
        <span className="flex-shrink-0 font-mono text-[11px] text-success tabular">
          {Math.round(chunk.similarity * 100)}%
        </span>
      )}
    </button>
  );
}
export default SourceRow;
