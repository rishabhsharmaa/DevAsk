'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SourceRow } from '@/components/source-row';
import type { SourceChunk } from '@/types';

interface MessageBubbleProps {
  message: {
    role: string;
    content: string;
    source_chunks?: SourceChunk[] | null;
    created_at?: string;
  };
  /** First message in the thread — skips the exchange separator. */
  first?: boolean;
  /** True while this assistant message is still streaming. */
  streaming?: boolean;
  onCitationClick?: (chunk: SourceChunk) => void;
}

/** Local HH:MM for persisted messages; live messages carry no timestamp. */
function formatTime(iso: string | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function MessageBubble({ message, first, streaming, onCitationClick }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const time = formatTime(message.created_at);

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — leave the button idle */
    }
  };

  if (isUser) {
    return (
      <div className={cn('animate-fade-in', !first && 'border-t border-border/60 pt-6')}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="label-micro text-muted-foreground">You</span>
          {time && (
            <span className="flex-shrink-0 font-mono text-[11px] text-muted-foreground/70 tabular">
              {time}
            </span>
          )}
        </div>
        <p className="mt-1.5 text-[15px] leading-relaxed font-medium break-words whitespace-pre-wrap">
          {message.content}
        </p>
      </div>
    );
  }

  return (
    <div className="group animate-fade-in">
      <div className="flex items-baseline justify-between gap-3">
        <span className="label-micro text-signal">DevAsk</span>
        {time && (
          <span className="flex-shrink-0 font-mono text-[11px] text-muted-foreground/70 tabular">
            {time}
          </span>
        )}
      </div>
      <div className="mt-1.5">
        <div className={cn('prose-chat text-[14px] text-foreground/90', streaming && 'stream-caret')}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                const inline = !match;
                return inline ? (
                  <code className={className} {...props}>
                    {children}
                  </code>
                ) : (
                  <CodeBlock language={match[1]} value={String(children).replace(/\n$/, '')} />
                );
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>

        {/* Citations — the verification interface, not footnotes */}
        {message.source_chunks && message.source_chunks.length > 0 && (
          <div className="mt-4 border-t border-border/70 pt-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="label-micro text-muted-foreground">Sources</p>
              <p className="flex-shrink-0 font-mono text-[11px] text-muted-foreground/70">
                {message.source_chunks.length} files · open to verify
              </p>
            </div>
            <div className="mt-1 divide-y divide-border/60">
              {message.source_chunks.map((chunk, index) => (
                <SourceRow
                  key={`${chunk.file_path}-${index}`}
                  index={index}
                  chunk={chunk}
                  onOpen={onCitationClick}
                />
              ))}
            </div>
          </div>
        )}

        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyMessage}
            className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-success" /> copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" /> copy answer
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function CodeBlock({ language, value }: { language: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="my-3 overflow-hidden border border-border bg-background font-mono">
      <div className="flex items-center justify-between border-b border-border bg-card px-3 py-1.5">
        <span className="text-[11px] text-muted-foreground">{language}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          aria-label={copied ? 'Copied' : 'Copy code block'}
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-success" />
              <span className="text-success">copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>copy</span>
            </>
          )}
        </button>
      </div>
      <div className="overflow-x-auto p-3">
        <pre className="!m-0 !border-0 !bg-transparent !p-0">
          <code className={cn('language-' + language, '!border-0 !bg-transparent !p-0')}>
            {value}
          </code>
        </pre>
      </div>
    </div>
  );
}
