'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, Terminal, FileCode, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SourceChunk } from '@/types';

interface MessageBubbleProps {
  message: {
    role: string;
    content: string;
    source_chunks?: SourceChunk[] | null;
  };
  onCitationClick?: (chunk: SourceChunk) => void;
}

export function MessageBubble({ message, onCitationClick }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div
      className={cn(
        "flex w-full gap-3 animate-fade-in mb-6",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
          <Terminal className="w-4 h-4 text-emerald-400" />
        </div>
      )}

      <div
        className={cn(
          "relative max-w-[85%] rounded-xl px-4 py-3 text-sm shadow-sm",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-none"
            : "bg-card border border-border text-foreground rounded-tl-none prose-chat"
        )}
      >
        {/* Copy button */}
        <button
          onClick={handleCopyMessage}
          className={cn(
            "absolute top-2 right-2 p-1 rounded-md bg-muted/50 text-muted-foreground opacity-0 hover:opacity-100 hover:text-foreground transition-all",
            "group-hover:opacity-100", // Needs parent to be group
            isUser ? "hidden" : "" // Only show copy on assistant messages
          )}
          title="Copy message"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </button>

        {isUser ? (
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        ) : (
          <div className="group relative">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ node, className, children, ...props }) {
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

            {/* Citations section */}
            {message.source_chunks && message.source_chunks.length > 0 && (
              <div className="mt-4 pt-3 border-t border-border/50 text-xs">
                <p className="font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                  <FileCode className="w-3.5 h-3.5" />
                  Sources cited:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {message.source_chunks.map((chunk, index) => (
                    <button
                      key={index}
                      onClick={() => onCitationClick?.(chunk)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted hover:bg-muted-hover border border-border/50 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      <span>[{index + 1}]</span>
                      <span className="truncate max-w-[180px] font-mono text-[11px]">
                        {chunk.file_path.split('/').pop()}
                      </span>
                      {chunk.similarity != null && (
                        <span className="text-[10px] text-emerald-400">
                          {Math.round(chunk.similarity * 100)}%
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
          <Terminal className="w-4 h-4 text-primary" />
        </div>
      )}
    </div>
  );
}

interface CodeBlockProps {
  language: string;
  value: string;
}

function CodeBlock({ language, value }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-3 rounded-lg border border-border bg-muted/30 overflow-hidden font-mono text-xs">
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-border bg-muted/60 text-muted-foreground">
        <span className="text-[10px] font-medium uppercase">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 p-0.5 rounded hover:bg-muted-hover hover:text-foreground transition-all"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span className="text-[10px]">Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="p-4 overflow-x-auto">
        <pre className="!m-0 !p-0 bg-transparent">
          <code className={cn("language-" + language, "bg-transparent !p-0 border-0")}>
            {value}
          </code>
        </pre>
      </div>
    </div>
  );
}
