'use client';

import React, { useEffect, useRef } from 'react';
import { MessageBubble } from './message-bubble';
import { ScrollArea } from '@/components/ui/scroll-area';
import { HelpCircle, Sparkles, MessageSquare, Terminal } from 'lucide-react';
import type { Message, SourceChunk } from '@/types';

interface MessageListProps {
  messages: Message[];
  onStarterClick: (question: string) => void;
  isLoading?: boolean;
  onCitationClick?: (chunk: SourceChunk) => void;
}

const STARTER_QUESTIONS = [
  'What is the core purpose of this codebase?',
  'Explain the overall architecture and folder layout.',
  'How does user authentication work here?',
  'Where are the main database queries or schemas defined?',
];

export function MessageList({
  messages,
  onStarterClick,
  isLoading,
  onCitationClick,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    const scrollContainer = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, [messages, isLoading]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-fade-in">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Sparkles className="w-6 h-6 text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Welcome to DevAsk!</h3>
        <p className="text-sm text-muted-foreground max-w-sm mb-8">
          The entire codebase has been indexed. Ask any questions, or click one of the suggestions below to get started:
        </p>

        <div className="grid sm:grid-cols-2 gap-3 max-w-xl w-full">
          {STARTER_QUESTIONS.map((question) => (
            <button
              key={question}
              onClick={() => onStarterClick(question)}
              className="flex items-start gap-3 rounded-xl border border-border bg-card/50 p-4 text-left text-sm hover:bg-muted hover:border-primary/30 transition-all cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <span>{question}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <ScrollArea ref={scrollRef} className="flex-1 px-6 py-4">
      <div className="flex flex-col min-w-full pb-10">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onCitationClick={onCitationClick}
          />
        ))}

        {isLoading && (
          <div className="flex w-full gap-3 justify-start animate-fade-in">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <Terminal className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="rounded-xl px-4 py-3 bg-card border border-border text-foreground rounded-tl-none flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
export default MessageList;
