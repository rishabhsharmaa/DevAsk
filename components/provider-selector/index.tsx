'use client';

import React, { useState } from 'react';
import { Eye, EyeOff, ShieldCheck, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LLMProvider, Plan, DEFAULT_MODELS } from '@/types';

interface ProviderSelectorProps {
  provider: LLMProvider;
  setProvider: (provider: LLMProvider) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  plan: Plan;
}

export function ProviderSelector({
  provider,
  setProvider,
  apiKey,
  setApiKey,
  plan,
}: ProviderSelectorProps) {
  const [showKey, setShowKey] = useState(false);
  const isFree = plan === 'free';

  const providers = [
    { value: 'openai', label: 'OpenAI (GPT-4o)', disabled: false },
    { value: 'anthropic', label: 'Anthropic (Claude Sonnet)', disabled: isFree },
    { value: 'gemini', label: 'Google (Gemini 2.5 Flash)', disabled: isFree },
  ];

  return (
    <div className="flex flex-col gap-4 p-4 rounded-xl border border-border bg-card/50 backdrop-blur-sm shadow-sm max-w-sm w-full">
      {/* Provider Selector */}
      <div className="space-y-1.5">
        <Label htmlFor="provider-select" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          LLM Provider
        </Label>
        <Select
          value={provider}
          onValueChange={(val) => setProvider(val as LLMProvider)}
        >
          <SelectTrigger id="provider-select" className="h-9 bg-card">
            <SelectValue placeholder="Select Provider" />
          </SelectTrigger>
          <SelectContent>
            {providers.map((p) => (
              <SelectItem
                key={p.value}
                value={p.value}
                disabled={p.disabled}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span>{p.label}</span>
                  {p.disabled && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20">
                      <Lock className="w-2 h-2" /> Pro
                    </span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* API Key Input */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="api-key-input" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            API Key (BYOK)
          </Label>
        </div>
        <div className="relative">
          <Input
            id="api-key-input"
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={`Enter your ${provider.toUpperCase()} API Key`}
            className="h-9 pr-9 bg-card font-mono text-xs"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Trust Badge */}
      <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-medium bg-emerald-500/10 px-2.5 py-1.5 rounded-lg border border-emerald-500/10 self-start">
        <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
        <span>Keys are used server-side only & never stored.</span>
      </div>
    </div>
  );
}
export default ProviderSelector;
