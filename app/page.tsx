import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import {
  ArrowRight,
  Check,
  FileCode2,
  FolderOpen,
  KeyRound,
  MessageSquareText,
  Search,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { StatusDot } from "@/components/status";

/**
 * DevAsk landing — a product page, not a SaaS poster.
 * Left-aligned editorial composition; the hero shows the real
 * workspace shape (explorer / conversation / citations).
 */
export default async function LandingPage() {
  const { userId } = await auth();
  const primaryHref = userId ? "/dashboard" : "/sign-up";

  return (
    <main className="min-h-screen bg-background">
      {/* ===== Navigation ===== */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center" aria-label="DevAsk home">
            <Brand />
          </Link>
          <nav className="hidden items-center gap-6 text-[13.5px] text-muted-foreground md:flex" aria-label="Product">
            <Link href="#product" className="transition-colors hover:text-foreground">
              Product
            </Link>
            <Link href="#indexing" className="transition-colors hover:text-foreground">
              Indexing
            </Link>
            <Link href="#models" className="transition-colors hover:text-foreground">
              Models
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            {userId ? (
              <Link
                href="/dashboard"
                className="inline-flex h-8 items-center gap-1.5 bg-primary px-3 text-[13.5px] font-semibold text-primary-foreground transition-colors hover:bg-primary/85"
              >
                Dashboard
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="hidden h-8 items-center px-3 text-[13.5px] font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
                >
                  Sign in
                </Link>
                <Link
                  href="/sign-up"
                  className="inline-flex h-8 items-center gap-1.5 bg-primary px-3 text-[13.5px] font-semibold text-primary-foreground transition-colors hover:bg-primary/85"
                >
                  Get started
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ===== Hero ===== */}
      <section className="border-b border-border">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 pt-14 pb-14 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:pt-20 lg:pb-20">
          <div className="animate-rise">
            <p className="font-mono text-xs tracking-wide text-muted-foreground">
              RAG over your repository — not README summaries
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-[3.4rem] lg:leading-[1.05]">
              Understand an entire codebase by talking to it.
            </h1>
            <p className="measure-reading mt-5 text-[15.5px] leading-relaxed text-muted-foreground">
              Paste a GitHub URL. DevAsk recursively indexes the codebase, then
              answers architecture and implementation questions with citations
              to the exact source files — so you can verify, not trust.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href={primaryHref}
                className="inline-flex h-10 items-center gap-2 bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/85"
              >
                {userId ? "Open dashboard" : "Start with a repo URL"}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="#product"
                className="inline-flex h-10 items-center gap-1.5 border border-border bg-card px-4 text-sm font-medium transition-colors hover:bg-accent"
              >
                See how it works
              </Link>
            </div>
            <dl className="mt-8 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11.5px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Check className="h-3 w-3 text-success" />
                <dt className="sr-only">Keys</dt>
                <dd>Bring your own API key</dd>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="h-3 w-3 text-success" />
                <dt className="sr-only">Citations</dt>
                <dd>Source citations on answers</dd>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="h-3 w-3 text-success" />
                <dt className="sr-only">Setup</dt>
                <dd>No IDE, no setup</dd>
              </div>
            </dl>
          </div>

          {/* Workspace preview — mirrors the real repo layout */}
          <div className="animate-rise stagger-1 min-w-0" aria-label="Preview of the DevAsk repository workspace">
            <div className="border border-border bg-card">
              <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
                <p className="truncate font-mono text-xs text-muted-foreground">
                  vercel<span className="text-muted-foreground/50">/</span>
                  <span className="text-foreground">next.js</span>
                </p>
                <p className="flex flex-shrink-0 items-center gap-1.5 font-mono text-[11px] text-success">
                  <StatusDot status="ready" />
                  Indexed · 4,182 files
                </p>
              </div>
              <div className="grid sm:grid-cols-[180px_minmax(0,1fr)]">
                <div className="hidden border-r border-border p-2 font-mono text-[11px] leading-6 text-muted-foreground sm:block">
                  <p className="flex items-center gap-1.5 px-1 text-foreground">
                    <FolderOpen className="h-3 w-3" /> packages
                  </p>
                  <p className="px-1 pl-5">next</p>
                  <p className="px-1 pl-9">src</p>
                  <p className="border border-border bg-background px-1 pl-9 text-foreground">
                    server<span className="text-muted-foreground/60">/</span>app-render
                  </p>
                  <p className="px-1 pl-[3.25rem]">index.ts</p>
                  <p className="px-1 pl-[3.25rem]">create-component-tree.tsx</p>
                </div>
                <div className="min-w-0 p-4 text-[13px] leading-relaxed">
                  <p className="font-medium">How does the App Router handle layouts?</p>
                  <p className="mt-2 text-muted-foreground">
                    Layouts nest per route segment. Each{" "}
                    <code className="border border-border bg-background px-1 py-px font-mono text-[11.5px] text-foreground">
                      layout.tsx
                    </code>{" "}
                    wraps its children during the server render pass{" "}
                    <span className="whitespace-nowrap">
                      <span className="border border-border bg-background px-1 py-px font-mono text-[11px] text-signal">[1]</span>{" "}
                      <span className="border border-border bg-background px-1 py-px font-mono text-[11px] text-signal">[2]</span>
                    </span>
                    .
                  </p>
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center gap-2 border border-border bg-background px-2 py-1.5 font-mono text-[11px]">
                      <span className="text-signal">[1]</span>
                      <FileCode2 className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                      <span className="truncate">app-render/index.ts</span>
                      <span className="ml-auto flex-shrink-0 text-success tabular">94%</span>
                    </div>
                    <div className="flex items-center gap-2 border border-border bg-background px-2 py-1.5 font-mono text-[11px]">
                      <span className="text-signal">[2]</span>
                      <FileCode2 className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                      <span className="truncate">app-render/create-component-tree.tsx</span>
                      <span className="ml-auto flex-shrink-0 text-success tabular">89%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-3 font-mono text-[11.5px] text-muted-foreground">
              Every answer ships with inspectable sources. Click a citation to read the snippet in context.
            </p>
          </div>
        </div>
      </section>

      {/* ===== Pipeline ===== */}
      <section id="product" className="scroll-mt-16 border-b border-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:py-[4.5rem]">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-[1.7rem]">
                From repository to understanding
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                One URL in, a queryable model of the codebase out. Four stages,
                each one inspectable — nothing is a black box.
              </p>
            </div>
            <ol className="divide-y divide-border border-y border-border">
              {[
                {
                  n: "01",
                  title: "Connect",
                  detail: "github.com/owner/repo",
                  body: "Paste any public repository URL — private repos work too when the server GitHub token can read them. DevAsk only ever reads through the API.",
                },
                {
                  n: "02",
                  title: "Index",
                  detail: "crawl → chunk → embed → store",
                  body: "The full file tree is crawled recursively, chunked per file, embedded, and stored in pgvector. No context-window ceiling.",
                },
                {
                  n: "03",
                  title: "Ask",
                  detail: "multi-turn, repo-scoped",
                  body: "Question the architecture, trace request flows, or find where a behavior is implemented — with the whole conversation scoped to the repo.",
                },
                {
                  n: "04",
                  title: "Verify",
                  detail: "[1] [2] [3] → source",
                  body: "Every answer cites the retrieved chunks with file paths and relevance. Open any citation and read the code it came from.",
                },
              ].map((step) => (
                <li key={step.n} className="grid gap-1 py-5 sm:grid-cols-[3.5rem_minmax(0,1fr)] sm:gap-4">
                  <span className="font-mono text-[13px] text-muted-foreground tabular">{step.n}</span>
                  <div>
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h3 className="text-[15px] font-semibold">{step.title}</h3>
                      <p className="font-mono text-xs text-muted-foreground">{step.detail}</p>
                    </div>
                    <p className="measure-reading mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ===== Indexing ===== */}
      <section id="indexing" className="scroll-mt-16 border-b border-border bg-card/40">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-[4.5rem]">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-[1.7rem]">
              Indexing that reads everything
            </h2>
            <p className="measure-reading mt-3 text-[15px] leading-relaxed text-muted-foreground">
              General-purpose chatbots fetch a README and a few visible files,
              then guess the rest. DevAsk builds a persistent search index over
              the complete tree — so large repos and private code are
              first-class citizens, not edge cases.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "Recursive crawl of the full tree via the GitHub API",
                "Per-file chunking that preserves code structure",
                "Semantic embeddings stored in pgvector for retrieval",
                "Persistent index — ask today, follow up next month",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="min-w-0 self-start border border-border bg-background">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <p className="font-mono text-xs text-muted-foreground">index report</p>
              <p className="flex items-center gap-1.5 font-mono text-[11px] text-success">
                <StatusDot status="ready" />
                complete
              </p>
            </div>
            <dl className="grid grid-cols-2 divide-x divide-border sm:grid-cols-4">
              {[
                ["files", "4,182"],
                ["chunks", "18,940"],
                ["language", "TypeScript"],
                ["retrieval", "semantic"],
              ].map(([term, value]) => (
                <div key={term} className="px-4 py-4">
                  <dt className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
                    {term}
                  </dt>
                  <dd className="mt-1 font-mono text-sm font-medium tabular">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="border-t border-border px-4 py-3">
              <p className="flex items-start gap-2 text-[13px] leading-relaxed text-muted-foreground">
                <Search className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                Each question runs a fresh semantic search against this index —
                answers are grounded in retrieved code, not model memory.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Conversation + citations ===== */}
      <section className="border-b border-border">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-[4.5rem]">
          <div className="min-w-0 self-start border border-border bg-card max-lg:order-2">
            <div className="border-b border-border px-4 py-2.5">
              <p className="font-mono text-xs text-muted-foreground">answer · with sources</p>
            </div>
            <div className="space-y-4 p-4 text-[13.5px] leading-relaxed">
              <p className="font-medium">Where is repository indexing implemented?</p>
              <p className="text-muted-foreground">
                Indexing starts at the API route, which validates the URL and
                fans out to the GitHub crawler{" "}
                <span className="border border-border bg-background px-1 py-px font-mono text-[11px] text-signal">[1]</span>.
                Files are chunked per language{" "}
                <span className="border border-border bg-background px-1 py-px font-mono text-[11px] text-signal">[2]</span>{" "}
                and embedded before storage.
              </p>
              <div className="border border-border bg-background p-3">
                <p className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="text-signal">[1]</span>
                  <span className="truncate">app/api/repo/index/route.ts</span>
                  <span className="ml-auto text-success tabular">96%</span>
                </p>
                <pre className="mt-2 overflow-x-auto font-mono text-[11.5px] leading-relaxed text-muted-foreground">
                  <code>{`const tree = await crawlRepo(owner, name);\nawait storeChunks(repoId, chunks);`}</code>
                </pre>
              </div>
              <p className="flex items-center gap-1.5 font-mono text-[11.5px] text-muted-foreground">
                <MessageSquareText className="h-3.5 w-3.5" />
                follow-up: “what happens when the crawl fails?”
              </p>
            </div>
          </div>
          <div className="max-lg:order-1">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-[1.7rem]">
              Answers you can interrogate
            </h2>
            <p className="measure-reading mt-3 text-[15px] leading-relaxed text-muted-foreground">
              A confident answer without provenance is a liability. DevAsk
              treats citations as the interface: relevance scores, file paths,
              and one click to the snippet — built for engineers who verify.
            </p>
            <div className="mt-6 grid gap-px border border-border bg-border">
              {[
                ["Numbered citations", "Each claim points at [1], [2], [3] — mapped to real chunks."],
                ["Relevance, stated plainly", "Match scores next to every source. Weak grounding is visible."],
                ["Snippet inspection", "Open a citation and read the retrieved code in full context."],
              ].map(([title, body]) => (
                <div key={title} className="bg-background px-4 py-3.5">
                  <h3 className="text-sm font-semibold">{title}</h3>
                  <p className="mt-0.5 text-[13.5px] leading-relaxed text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== Models / BYOK ===== */}
      <section id="models" className="scroll-mt-16 border-b border-border bg-card/40">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:py-[4.5rem]">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-[1.7rem]">
              Your models, your keys
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              DevAsk is a retrieval layer, not a model lock-in. Pick the
              provider you trust and bring your own key.
            </p>
            <p className="mt-5 flex items-start gap-2.5 border border-border bg-background px-4 py-3 text-[13.5px] leading-relaxed">
              <KeyRound className="mt-0.5 h-4 w-4 flex-shrink-0 text-signal" />
              <span>
                Your key is used for the request in flight and is never stored.
                That is a design constraint, not a policy promise.
              </span>
            </p>
          </div>
          <div className="self-start border border-border bg-background">
            {(
              [
                ["OpenAI", "GPT-4o"],
                ["Anthropic", "Claude Sonnet 4"],
                ["Google", "Gemini 3.8 Flash"],
              ] as [string, string][]
            ).map(([provider, model], i) => (
              <div
                key={provider}
                className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-3.5 sm:grid-cols-[140px_minmax(0,1fr)] sm:gap-4 ${i > 0 ? "border-t border-border" : ""}`}
              >
                <p className="text-sm font-semibold">{provider}</p>
                <p className="font-mono text-xs text-muted-foreground sm:text-right">{model}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Final CTA ===== */}
      <section className="border-b border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-14 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:py-16">
          <div>
            <h2 className="max-w-xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Paste a URL. Ask the hard questions.
            </h2>
            <p className="measure-reading mt-3 text-[15px] leading-relaxed text-muted-foreground">
              Onboard in an afternoon, trace bugs to their source, and hand
              reviewers answers that cite their evidence.
            </p>
          </div>
          <Link
            href={primaryHref}
            className="inline-flex h-11 flex-shrink-0 items-center gap-2 bg-primary px-5 text-[15px] font-semibold text-primary-foreground transition-colors hover:bg-primary/85"
          >
            {userId ? "Go to dashboard" : "Index your first repo"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="px-4 py-8 sm:px-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Brand />
          <p className="font-mono text-[11.5px] text-muted-foreground">
            © {new Date().getFullYear()} DevAsk — understand any codebase.
          </p>
          <nav className="flex gap-5 text-[13px] text-muted-foreground" aria-label="Footer">
            <Link href="#product" className="transition-colors hover:text-foreground">
              Product
            </Link>
            <Link href={userId ? "/dashboard" : "/sign-in"} className="transition-colors hover:text-foreground">
              {userId ? "Dashboard" : "Sign in"}
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
