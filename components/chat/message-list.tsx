'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight } from 'lucide-react';
import { MessageBubble } from './message-bubble';
import { cn } from '@/lib/utils';
import type { Message, SourceChunk } from '@/types';

interface MessageListProps {
  messages: Message[];
  onStarterClick: (question: string) => void;
  isLoading?: boolean;
  onCitationClick?: (chunk: SourceChunk) => void;
}

const STARTERS = [
  {
    title: 'Architecture',
    sub: 'Understand the stack',
    prompt: 'Explain the authentication architecture.',
  },
  {
    title: 'Find implementation',
    sub: 'Locate a feature',
    prompt: 'Where is repository indexing implemented?',
  },
  {
    title: 'Trace a flow',
    sub: 'Follow code paths',
    prompt: 'Trace the request from the chat UI to the LLM.',
  },
  {
    title: 'Find bottlenecks',
    sub: 'Spot architectural risks',
    prompt: 'Find potential architectural bottlenecks.',
  },
];

export function MessageList({
  messages,
  onStarterClick,
  isLoading,
  onCitationClick,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [stickToBottom, setStickToBottom] = useState(true);
  const [showJumpButton, setShowJumpButton] = useState(false);

  // Follow the stream only while the reader is already at the bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, isLoading, stickToBottom]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distance < 48;
    setStickToBottom(atBottom);
    setShowJumpButton(!atBottom && messages.length > 0);
  };

  const jumpToLatest = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setStickToBottom(true);
    setShowJumpButton(false);
  };

  if (messages.length === 0) {
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col justify-center overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-8 [scrollbar-gutter:stable] sm:px-6">
        <div className="mx-auto w-full max-w-2xl animate-fade-in">
          <p className="label-micro text-muted-foreground">Understand this repository</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">
            What would you like to investigate?
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            The full index is loaded. Every answer cites the files it came from —
            open any source to verify.
          </p>

          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            {STARTERS.map((starter) => (
              <button
                key={starter.title}
                type="button"
                onClick={() => onStarterClick(starter.prompt)}
                className="group border border-border bg-card/40 p-4 text-left transition-colors hover:border-signal/40 hover:bg-card"
              >
                <span className="flex items-center justify-between gap-2 text-sm font-medium">
                  {starter.title}
                  <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-signal" />
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">{starter.sub}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id;

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-6 [scrollbar-gutter:stable] sm:px-6"
        aria-live="polite"
      >
        <div className="mx-auto w-full max-w-3xl space-y-7 pb-4">
          {messages.map((message, i) => (
            <MessageBubble
              key={message.id}
              message={message}
              first={i === 0}
              streaming={isLoading && message.id === lastAssistantId && message.role === 'assistant'}
              onCitationClick={onCitationClick}
            />
          ))}

          {isLoading && messages[messages.length - 1]?.role === 'user' && (
            <div className="animate-fade-in" role="status">
              <span className="label-micro text-signal">DevAsk</span>
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                Searching the index<span className="animate-status-breathe">…</span>
              </p>
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={jumpToLatest}
        aria-hidden={!showJumpButton}
        tabIndex={showJumpButton ? 0 : -1}
        className={cn(
          'absolute bottom-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 border border-border bg-card px-3 py-1.5 font-mono text-[11.5px] text-muted-foreground shadow-lg transition-all hover:text-foreground',
          showJumpButton ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
        )}
      >
        <ArrowDown className="h-3 w-3" />
        latest
      </button>
    </div>
  );
}
export default MessageList;
