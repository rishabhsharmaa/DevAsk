'use client';

import React, { useRef, useEffect, useState } from 'react';
import { ArrowUp, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MODEL_DISPLAY_NAMES } from '@/components/provider-selector';
import type { LLMProvider } from '@/types';

interface ChatInputProps {
  onSubmit: (message: string) => void;
  isLoading: boolean;
  disabled?: boolean;
  provider: LLMProvider;
  hasKey: boolean;
  onConnectKey: () => void;
}

const PROVIDER_LABEL: Record<LLMProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Gemini',
};

export function ChatInput({ onSubmit, isLoading, disabled, provider, hasKey, onConnectKey }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea heights based on input length
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [value]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!value.trim() || isLoading || disabled) return;

    onSubmit(value.trim());
    setValue('');

    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter (without shift) to submit
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border border-border bg-card transition-colors focus-within:border-signal/50">
      {!hasKey ? (
        <button
          type="button"
          onClick={onConnectKey}
          className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left transition-colors hover:bg-accent/60"
        >
          <KeyRound className="h-4 w-4 flex-shrink-0 text-signal" />
          <span className="text-[13.5px]">
            <span className="font-medium">Connect your {PROVIDER_LABEL[provider]} API key to ask.</span>{' '}
            <span className="text-muted-foreground">Used for this request only — never stored.</span>
          </span>
        </button>
      ) : (
        <form onSubmit={handleSubmit}>
          <label htmlFor="chat-input" className="sr-only">
            Ask a question about the codebase
          </label>
          <textarea
            id="chat-input"
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about architecture, trace a flow, find an implementation…"
            disabled={isLoading || disabled}
            className="max-h-[200px] min-h-[46px] w-full resize-none bg-transparent px-3.5 pt-3 text-[14px] leading-relaxed outline-none placeholder:text-muted-foreground/70 disabled:opacity-50"
          />
          <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5">
            <p className="truncate px-1 font-mono text-[11px] text-muted-foreground">
              {MODEL_DISPLAY_NAMES[provider]}
            </p>
            <div className="flex items-center gap-2">
              <span className="hidden font-mono text-[11px] text-muted-foreground/70 sm:inline">
                enter to send · shift+enter for newline
              </span>
              <Button
                type="submit"
                size="icon-sm"
                disabled={!value.trim() || isLoading || disabled}
                aria-label="Send message"
                className={cn(!value.trim() && 'opacity-40')}
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
export default ChatInput;
