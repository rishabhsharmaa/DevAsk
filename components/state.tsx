"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Guidance-first empty state: names the situation, explains the
 * next useful step, and offers a primary + secondary action.
 */
export function EmptyState({
  icon,
  title,
  body,
  primary,
  secondary,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  primary?: { label: string; onClick: () => void };
  secondary?: { label: string; href: string };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 border border-dashed border-border bg-card/40 p-6 sm:p-8",
        className
      )}
    >
      <div className="flex h-9 w-9 items-center justify-center border border-border bg-card text-muted-foreground">
        {icon}
      </div>
      <div className="measure-narrow">
        <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
      {(primary || secondary) && (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {primary && (
            <Button size="sm" onClick={primary.onClick}>
              {primary.label}
            </Button>
          )}
          {secondary && (
            <Button size="sm" variant="ghost" asChild>
              <a href={secondary.href}>{secondary.label}</a>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** Calm, actionable inline error. Never a raw dump. */
export function InlineError({
  title,
  body,
  action,
  className,
}: {
  title: string;
  body?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 border border-destructive/25 bg-destructive/[7%] px-4 py-3",
        className
      )}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {body && (
          <p className="mt-0.5 break-words text-[13px] leading-relaxed text-muted-foreground">
            {body}
          </p>
        )}
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="mt-1.5 text-[13px] font-medium text-foreground underline underline-offset-4 hover:text-muted-foreground"
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}

/** Small field-level error line for forms. */
export function FieldError({ message }: { message: string }) {
  return (
    <p role="alert" className="flex items-start gap-1.5 text-[13px] leading-snug text-destructive">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
      <span>{message}</span>
    </p>
  );
}
