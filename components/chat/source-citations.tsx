'use client';

import React, { useState } from 'react';
import { FileCode, ExternalLink, Percent, ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { SourceChunk } from '@/types';

interface SourceCitationsProps {
  sources: SourceChunk[];
  openSourceIndex?: number | null;
  onCloseSource?: () => void;
}

export function SourceCitations({
  sources,
  openSourceIndex,
  onCloseSource,
}: SourceCitationsProps) {
  const [localOpenIndex, setLocalOpenIndex] = useState<number | null>(null);

  const activeIndex = openSourceIndex !== undefined ? openSourceIndex : localOpenIndex;
  const handleClose = () => {
    if (onCloseSource) {
      onCloseSource();
    } else {
      setLocalOpenIndex(null);
    }
  };

  const activeChunk = activeIndex !== null ? sources[activeIndex] : null;

  return (
    <>
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Context Citations ({sources.length})
        </h4>
        <div className="grid gap-2">
          {sources.map((source, index) => (
            <button
              key={index}
              onClick={() => {
                if (openSourceIndex === undefined) {
                  setLocalOpenIndex(index);
                }
              }}
              className="flex items-center justify-between w-full p-2.5 rounded-lg border border-border bg-card hover:bg-muted text-left text-xs transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-2 truncate">
                <FileCode className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="truncate font-mono font-medium">{source.file_path}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 text-muted-foreground group-hover:text-foreground">
                {source.similarity != null && (
                  <span className="flex items-center text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/10">
                    {Math.round(source.similarity * 100)}% Match
                  </span>
                )}
                <ExternalLink className="w-3.5 h-3.5 opacity-60" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Code Viewer Dialog */}
      <Dialog open={activeChunk !== null} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-card border border-border">
          {activeChunk && (
            <>
              <DialogHeader className="p-4 border-b border-border bg-muted/30">
                <DialogTitle className="font-mono text-sm flex items-center gap-2 truncate">
                  <FileCode className="w-4 h-4 text-primary" />
                  {activeChunk.file_path}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Retrieved codebase snippet used to contextually answer your prompt.
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-auto p-4 bg-muted/10 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                {activeChunk.content}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
export default SourceCitations;
