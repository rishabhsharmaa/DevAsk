'use client';

import React, { useRef, useEffect, useState } from 'react';
import { SendHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChatInputProps {
  onSubmit: (message: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

export function ChatInput({ onSubmit, isLoading, disabled }: ChatInputProps) {
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
    // Cmd+Enter or Ctrl+Enter or pure Enter (without shift) to submit
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="relative flex items-end gap-2 rounded-xl border border-input bg-card p-2 shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all glow-violet-sm"
    >
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask anything about the codebase... (Enter to send, Shift+Enter for newline)"
        disabled={isLoading || disabled}
        className="flex-1 max-h-[200px] min-h-[38px] resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/80 disabled:opacity-50"
      />
      <Button
        type="submit"
        size="icon"
        variant="default"
        disabled={!value.trim() || isLoading || disabled}
        className="h-9 w-9 rounded-lg flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/80 transition-colors"
      >
        <SendHorizontal className="h-4.5 w-4.5" />
      </Button>
    </form>
  );
}
export default ChatInput;
