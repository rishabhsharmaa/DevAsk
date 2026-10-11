import { cn } from "@/lib/utils";

/**
 * DevAsk wordmark — monospace name closed by a signal block,
 * a quiet nod to the ask / answer loop. No mascot, no glow.
 */
export function Brand({
  className,
  blockClassName,
}: {
  className?: string;
  blockClassName?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1 font-mono text-[15px] font-semibold tracking-tight text-foreground",
        className
      )}
    >
      devask
      <span
        aria-hidden
        className={cn("inline-block h-[0.72em] w-[0.5em] self-center bg-signal", blockClassName)}
      />
    </span>
  );
}

/** Compact square glyph for tight spaces (mobile nav, favicons-in-UI). */
export function BrandGlyph({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex h-6 w-6 items-center justify-center border border-border bg-card font-mono text-[13px] font-semibold text-foreground",
        className
      )}
    >
      d<span className="ml-[1px] inline-block h-[0.7em] w-[0.32em] self-center bg-signal" />
    </span>
  );
}
