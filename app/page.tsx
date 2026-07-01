import Link from "next/link";
import { auth } from '@clerk/nextjs/server';
import {
  GitBranch,
  MessageSquare,
  Key,
  Search,
  Shield,
  Zap,
  Code2,
  FileSearch,
  Clock,
  Share2,
  ArrowRight,
  Check,
  Github,
  Brain,
  Database,
  Sparkles,
} from "lucide-react";

/**
 * DevAsk Landing Page
 * 
 * Designed to immediately communicate the core value proposition:
 * "Understand any codebase in minutes — no IDE, no setup, just a URL."
 * 
 * Sections:
 * 1. Hero with gradient background + CTA
 * 2. How It Works (3-step flow)
 * 3. Why DevAsk vs ChatGPT/Claude (differentiation)
 * 4. Features grid
 * 5. Pricing (Free vs Pro)
 * 6. Trust signals + Footer
 */
export default async function LandingPage() {
  const { userId } = await auth();

  return (
    <main className="relative overflow-hidden">
      {/* ===== Background effects ===== */}
      <div className="fixed inset-0 bg-dots pointer-events-none opacity-40" />
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, oklch(0.65 0.25 290 / 8%) 0%, transparent 60%)",
        }}
      />

      {/* ===== Navigation ===== */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-2 group" id="nav-logo">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Code2 className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold tracking-tight">DevAsk</span>
        </Link>
        <div className="flex items-center gap-4">
          {userId ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors"
              id="nav-dashboard"
            >
              Go to Dashboard
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                id="nav-sign-in"
              >
                Sign In
              </Link>
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors"
                id="nav-get-started"
              >
                Get Started
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* ===== Hero Section ===== */}
      <section className="relative z-10 px-6 pt-20 pb-24 max-w-5xl mx-auto text-center">
        <div className="animate-slide-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/50 px-4 py-1.5 text-xs text-muted-foreground mb-8 backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            Powered by RAG — real semantic search, not just README parsing
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
            Understand any codebase
            <br />
            <span className="text-gradient">in minutes</span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Paste a GitHub repo URL and have a meaningful, multi-turn conversation
            with the entire codebase. No IDE, no setup, just a URL.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {userId ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-base font-medium text-primary-foreground hover:bg-primary/80 transition-all glow-violet hover:glow-violet-sm"
                id="hero-cta"
              >
                Go to Dashboard
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-base font-medium text-primary-foreground hover:bg-primary/80 transition-all glow-violet hover:glow-violet-sm"
                id="hero-cta"
              >
                <Github className="w-4.5 h-4.5" />
                Start with GitHub
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
            <Link
              href="#how-it-works"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/50 px-6 py-3 text-base font-medium text-foreground hover:bg-accent transition-colors backdrop-blur-sm"
              id="hero-learn-more"
            >
              See how it works
            </Link>
          </div>
        </div>

        {/* Chat preview mock */}
        <div className="mt-16 animate-slide-up stagger-2 opacity-0">
          <div className="glass rounded-2xl p-1 max-w-3xl mx-auto glow-violet-sm">
            <div className="rounded-xl bg-card/80 p-6 text-left space-y-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground border-b border-border/50 pb-3">
                <GitBranch className="w-3.5 h-3.5" />
                <span>vercel/next.js</span>
                <span className="ml-auto flex items-center gap-1 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Indexed
                </span>
              </div>
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MessageSquare className="w-3.5 h-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">How does the App Router handle layouts?</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Brain className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="text-sm text-muted-foreground">
                  <p className="mb-2">
                    Based on the source code, the App Router uses a nested layout system defined in{" "}
                    <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">
                      packages/next/src/server/app-render/
                    </code>
                    . Each route segment can have its own <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">layout.tsx</code> that wraps child segments...
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      <FileSearch className="w-3 h-3" />
                      app-render/index.ts
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      <FileSearch className="w-3 h-3" />
                      create-component-tree.tsx
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== How It Works ===== */}
      <section id="how-it-works" className="relative z-10 px-6 py-24 max-w-5xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4 tracking-tight">
          Three steps. That&apos;s it.
        </h2>
        <p className="text-muted-foreground text-center mb-16 max-w-xl mx-auto">
          From repo URL to intelligent conversation in under a minute.
        </p>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              step: "01",
              icon: GitBranch,
              title: "Paste Repo URL",
              description:
                "Drop any public or private GitHub repo link. We support everything from tiny utilities to massive monorepos.",
            },
            {
              step: "02",
              icon: Key,
              title: "Bring Your API Key",
              description:
                "Use your own key from OpenAI, Anthropic, or Google. We never store it — it's used once per request, then discarded.",
            },
            {
              step: "03",
              icon: MessageSquare,
              title: "Ask Questions",
              description:
                "Chat with your codebase like a teammate who's read every file. Get answers with exact source-file citations.",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="group relative rounded-xl border border-border/50 bg-card/50 p-6 hover:bg-card/80 transition-all duration-300 hover:border-primary/30"
            >
              <span className="text-5xl font-bold text-muted/30 absolute top-4 right-4 transition-colors group-hover:text-primary/20">
                {item.step}
              </span>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <item.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Why Not ChatGPT? ===== */}
      <section className="relative z-10 px-6 py-24 border-y border-border/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4 tracking-tight">
            Why not just paste a URL into ChatGPT?
          </h2>
          <p className="text-muted-foreground text-center mb-16 max-w-2xl mx-auto">
            General LLMs fetch the README and a few visible files. DevAsk indexes{" "}
            <em>everything</em>.
          </p>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* ChatGPT limitations */}
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2 text-destructive">
                <span className="w-6 h-6 rounded-full bg-destructive/20 flex items-center justify-center text-xs">✕</span>
                General LLMs
              </h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {[
                  "Fetches README + a few visible files",
                  "Hits context limits on large repos",
                  "No memory between sessions",
                  "Can't access private repos",
                  "No source-file citations",
                  "Hallucinates file contents",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="text-destructive mt-0.5">✕</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* DevAsk advantages */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 glow-violet-sm">
              <h3 className="font-semibold mb-4 flex items-center gap-2 text-primary">
                <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs">
                  <Check className="w-3.5 h-3.5" />
                </span>
                DevAsk
              </h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {[
                  "Recursively crawls the complete file tree via GitHub API",
                  "Indexes everything into pgvector — no context limits",
                  "Persistent index + full conversation history",
                  "Private repo access via GitHub OAuth",
                  "Source-file citations on every answer",
                  "Real semantic search per question",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Features Grid ===== */}
      <section className="relative z-10 px-6 py-24 max-w-5xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4 tracking-tight">
          Everything you need
        </h2>
        <p className="text-muted-foreground text-center mb-16 max-w-xl mx-auto">
          Built for developers who want deep understanding, not surface-level summaries.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              icon: Database,
              title: "Full RAG Indexing",
              description: "Every file chunked, embedded, and stored in pgvector for real semantic search.",
            },
            {
              icon: Zap,
              title: "Streaming Responses",
              description: "See answers token by token. No waiting for the entire response to generate.",
            },
            {
              icon: FileSearch,
              title: "Source Citations",
              description: "Every answer shows exactly which files were used as context. Verify everything.",
            },
            {
              icon: Search,
              title: "Semantic Search",
              description: "Find relevant code by meaning, not just keywords. Understands intent.",
            },
            {
              icon: Clock,
              title: "Persistent History",
              description: "Pick up where you left off. Full conversation history saved across sessions.",
            },
            {
              icon: Shield,
              title: "BYOK — Your Keys",
              description: "Bring your own API keys. We never store them — used once per request, then gone.",
            },
            {
              icon: Github,
              title: "Private Repos",
              description: "Access private repos via GitHub OAuth. Your code never leaves the API pipeline.",
            },
            {
              icon: Share2,
              title: "Shareable Links",
              description: "Share a conversation about a codebase with your team. One click.",
            },
            {
              icon: Code2,
              title: "Multi-Provider",
              description: "Choose between OpenAI, Anthropic, or Google. Use your favorite model.",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="group rounded-xl border border-border/50 bg-card/30 p-5 hover:bg-card/60 transition-all duration-300 hover:border-primary/20"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <feature.icon className="w-4.5 h-4.5 text-primary" />
              </div>
              <h3 className="font-semibold mb-1.5">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Pricing ===== */}
      <section className="relative z-10 px-6 py-24 border-y border-border/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4 tracking-tight">
            Simple pricing
          </h2>
          <p className="text-muted-foreground text-center mb-16">
            Start free. Upgrade when you need more.
          </p>

          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {/* Free Tier */}
            <div className="rounded-xl border border-border/50 bg-card/30 p-8">
              <h3 className="text-lg font-semibold mb-1">Free</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Perfect for trying it out
              </p>
              <div className="text-4xl font-bold mb-6">
                $0
                <span className="text-base font-normal text-muted-foreground">
                  /mo
                </span>
              </div>
              <ul className="space-y-3 text-sm mb-8">
                {[
                  "2 public repos",
                  "1 LLM provider (OpenAI)",
                  "Basic chat",
                  "Session-only history",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-muted-foreground" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href={userId ? "/dashboard" : "/sign-up"}
                className="block w-full text-center rounded-lg border border-border py-2.5 text-sm font-medium hover:bg-accent transition-colors"
                id="pricing-free"
              >
                Get Started
              </Link>
            </div>

            {/* Pro Tier */}
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-8 relative glow-violet-sm">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
                Popular
              </div>
              <h3 className="text-lg font-semibold mb-1">Pro</h3>
              <p className="text-sm text-muted-foreground mb-6">
                For serious development work
              </p>
              <div className="text-4xl font-bold mb-1">
                $9
                <span className="text-base font-normal text-muted-foreground">
                  /mo
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-6">
                ₹499/mo in India
              </p>
              <ul className="space-y-3 text-sm mb-8">
                {[
                  "Unlimited repos",
                  "Private repo access",
                  "All LLM providers",
                  "Persistent chat history",
                  "Shareable links",
                  "Export conversations",
                  "Large repo support",
                  "Auto-generated summaries",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href={userId ? "/dashboard" : "/sign-up"}
                className="block w-full text-center rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors"
                id="pricing-pro"
              >
                Start Pro
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Trust Signals ===== */}
      <section className="relative z-10 px-6 py-16 max-w-4xl mx-auto">
        <div className="flex flex-wrap justify-center gap-8 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            We never store your API keys
          </div>
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-primary" />
            Your code stays in the API pipeline
          </div>
          <div className="flex items-center gap-2">
            <Github className="w-4 h-4 text-primary" />
            GitHub OAuth for secure access
          </div>
        </div>
      </section>

      {/* ===== Final CTA ===== */}
      <section className="relative z-10 px-6 py-24 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4 tracking-tight">
          Ready to understand your codebase?
        </h2>
        <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
          Join developers who use DevAsk to onboard faster, debug smarter, and
          understand code deeply.
        </p>
        <Link
          href={userId ? "/dashboard" : "/sign-up"}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-base font-medium text-primary-foreground hover:bg-primary/80 transition-all glow-violet"
          id="footer-cta"
        >
          {userId ? "Go to Dashboard" : "Get Started — It's Free"}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      {/* ===== Footer ===== */}
      <footer className="relative z-10 border-t border-border/30 px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
              <Code2 className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="text-sm font-medium">DevAsk</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} DevAsk. Built for developers, by developers.
          </p>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <Link href="#" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link href="#" className="hover:text-foreground transition-colors">
              Terms
            </Link>
            <Link href="https://github.com" className="hover:text-foreground transition-colors">
              GitHub
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
