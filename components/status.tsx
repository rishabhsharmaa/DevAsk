"use client";

import { cn } from "@/lib/utils";
import type { IndexStatus } from "@/types";

const STATUS_META: Record<
  IndexStatus,
  { label: string; dot: string; text: string; breathe: boolean }
> = {
  ready: {
    label: "Indexed",
    dot: "bg-success",
    text: "text-success",
    breathe: false,
  },
  indexing: {
    label: "Indexing",
    dot: "bg-signal",
    text: "text-signal",
    breathe: true,
  },
  pending: {
    label: "Queued",
    dot: "bg-muted-foreground",
    text: "text-muted-foreground",
    breathe: true,
  },
  failed: {
    label: "Failed",
    dot: "bg-destructive",
    text: "text-destructive",
    breathe: false,
  },
};

export function StatusDot({
  status,
  className,
}: {
  status: IndexStatus;
  className?: string;
}) {
  const meta = STATUS_META[status];
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block h-1.5 w-1.5 rounded-full",
        meta.dot,
        meta.breathe && "animate-status-breathe",
        className
      )}
    />
  );
}

/**
 * Truthful, low-contrast status readout. Square, mono, no pill —
 * it reads as instrumentation, not decoration.
 */
export function StatusBadge({
  status,
  className,
}: {
  status: IndexStatus;
  className?: string;
}) {
  const meta = STATUS_META[status];
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-1.5 border border-border bg-card px-1.5 py-0.5 font-mono text-[11px] font-medium tracking-wide",
        meta.text,
        className
      )}
    >
      <StatusDot status={status} />
      {meta.label}
    </span>
  );
}

export function statusLabel(status: IndexStatus): string {
  return STATUS_META[status].label;
}
