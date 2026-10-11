'use client';

import React, { useState } from 'react';
import { Check, ChevronDown, Eye, EyeOff, KeyRound, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { LLMProvider, Plan, DEFAULT_MODELS } from '@/types';

interface ProviderSelectorProps {
  provider: LLMProvider;
  setProvider: (provider: LLMProvider) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  plan: Plan;
  /** Controlled dialog state so the chat input can request it. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Human names for the exact models in DEFAULT_MODELS. */
export const MODEL_DISPLAY_NAMES: Record<LLMProvider, string> = {
  openai: 'GPT-4o',
  anthropic: 'Claude Sonnet 4',
  gemini: 'Gemini 3.8 Flash',
};

const PROVIDERS: { value: LLMProvider; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'gemini', label: 'Google' },
];

export function ProviderSelector({
  provider,
  setProvider,
  apiKey,
  setApiKey,
  plan,
  open,
  onOpenChange,
}: ProviderSelectorProps) {
  const [showKey, setShowKey] = useState(false);
  const [draftKey, setDraftKey] = useState(apiKey);
  const isFree = plan === 'free';

  const activeLabel = PROVIDERS.find((p) => p.value === provider)?.label ?? provider;
  const activeModel = MODEL_DISPLAY_NAMES[provider];

  const handleOpenChange = (next: boolean) => {
    if (next) setDraftKey(apiKey);
    onOpenChange(next);
  };

  const handleSave = () => {
    setApiKey(draftKey.trim());
    onOpenChange(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => handleOpenChange(true)}
        className="inline-flex h-8 max-w-full items-center gap-2 border border-border bg-card px-2.5 text-[13px] transition-colors hover:bg-accent"
        aria-label={`Model settings. Current: ${activeModel}. ${apiKey ? 'API key connected.' : 'No API key.'}`}
      >
        <span
          aria-hidden
          className={cn(
            'h-1.5 w-1.5 flex-shrink-0 rounded-full',
            apiKey ? 'bg-success' : 'bg-signal animate-status-breathe'
          )}
        />
        <span className="truncate font-medium">{activeModel}</span>
        <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Answer model</DialogTitle>
            <DialogDescription>
              The chat model answers from retrieved code. The key travels with
              each request and is never written to storage.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm leading-none font-medium">Model</p>
              <div role="radiogroup" aria-label="Answer model" className="space-y-1.5">
                {PROVIDERS.map((p) => {
                  const locked = isFree && p.value !== 'openai';
                  const active = provider === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={locked}
                      onClick={() => setProvider(p.value)}
                      className={cn(
                        'flex w-full items-center gap-3 border px-3 py-2.5 text-left transition-colors',
                        active
                          ? 'border-signal/50 bg-card'
                          : 'border-border bg-card/40 hover:border-muted-foreground/40 hover:bg-card',
                        locked && 'cursor-not-allowed opacity-60 hover:border-border hover:bg-card/40'
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full border',
                          active ? 'border-signal' : 'border-muted-foreground/50'
                        )}
                      >
                        {active && <span className="h-1.5 w-1.5 rounded-full bg-signal" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">
                          {MODEL_DISPLAY_NAMES[p.value]}
                        </span>
                        <span className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground">
                          {p.label} · {DEFAULT_MODELS[p.value]}
                        </span>
                      </span>
                      {locked && (
                        <span className="inline-flex flex-shrink-0 items-center gap-1 border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                          <Lock className="h-2.5 w-2.5" /> Pro
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {isFree && (
                <p className="text-[13px] text-muted-foreground">
                  Free plan includes OpenAI. Anthropic and Gemini unlock with Pro.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="api-key-input">{activeLabel} API key</Label>
              <div className="relative">
                <KeyRound className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                {/* new-password (not off): the standard signal that this is a
                    fresh secret, so managers don't fill saved logins here or
                    pair another field on the page as its "username". */}
                <Input
                  id="api-key-input"
                  name="devask-provider-api-key"
                  type={showKey ? 'text' : 'password'}
                  value={draftKey}
                  onChange={(e) => setDraftKey(e.target.value)}
                  placeholder={`sk-… (${activeLabel})`}
                  className="h-10 pr-10 pl-9 font-mono text-[13px]"
                  autoComplete="new-password"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showKey ? 'Hide API key' : 'Show API key'}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="flex items-start gap-1.5 text-[13px] leading-relaxed text-muted-foreground">
                <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-success" />
                Used for the request in flight, then discarded. Revoke it at the
                provider any time.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!draftKey.trim()}>
              {apiKey ? 'Update key' : 'Connect key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
export default ProviderSelector;
