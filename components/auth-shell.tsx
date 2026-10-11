import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Brand } from "@/components/brand";

/**
 * Shared authentication frame: brand + product context on the left,
 * the Clerk card on the right. Clerk functionality untouched.
 */
export function AuthShell({
  children,
  heading,
  body,
}: {
  children: React.ReactNode;
  heading: string;
  body: string;
}) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="hidden flex-col justify-between border-r border-border bg-card/40 p-8 lg:flex xl:p-12">
        <Link href="/" className="w-fit" aria-label="Back to DevAsk home">
          <Brand />
        </Link>
        <div className="max-w-md">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">{heading}</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{body}</p>
          <dl className="mt-8 space-y-3 font-mono text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <dt className="w-16 flex-shrink-0 text-muted-foreground/70 tabular">01</dt>
              <dd>Paste a GitHub URL to index the full tree</dd>
            </div>
            <div className="flex items-center gap-3">
              <dt className="w-16 flex-shrink-0 text-muted-foreground/70 tabular">02</dt>
              <dd>Ask architecture questions in plain language</dd>
            </div>
            <div className="flex items-center gap-3">
              <dt className="w-16 flex-shrink-0 text-muted-foreground/70 tabular">03</dt>
              <dd>Verify every answer against cited sources</dd>
            </div>
          </dl>
        </div>
        <p className="font-mono text-[11.5px] text-muted-foreground">
          Your API keys are never stored. Your code stays in the API pipeline.
        </p>
      </div>

      <div className="flex flex-col p-4 sm:p-8">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
          <span className="lg:hidden">
            <Brand />
          </span>
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
    </main>
  );
}
