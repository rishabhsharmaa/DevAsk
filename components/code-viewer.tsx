"use client";

import * as React from "react";
import { Check, Copy, FileCode2 } from "lucide-react";
import { cn } from "@/lib/utils";

function languageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "TypeScript",
    tsx: "TypeScript",
    js: "JavaScript",
    jsx: "JavaScript",
    py: "Python",
    rb: "Ruby",
    go: "Go",
    rs: "Rust",
    java: "Java",
    kt: "Kotlin",
    swift: "Swift",
    c: "C",
    h: "C",
    cpp: "C++",
    cs: "C#",
    sql: "SQL",
    md: "Markdown",
    mdx: "MDX",
    json: "JSON",
    yml: "YAML",
    yaml: "YAML",
    toml: "TOML",
    css: "CSS",
    scss: "SCSS",
    html: "HTML",
    sh: "Shell",
    bash: "Shell",
  };
  return map[ext] ?? (ext ? ext.toUpperCase() : "Text");
}

/**
 * First-class code surface: file header with language + copy,
 * line numbers, calm scrolling. No fake highlighting.
 */
export function CodeViewer({
  path,
  content,
  similarity,
  className,
  headerClassName,
}: {
  path: string;
  content: string;
  similarity?: number | null;
  className?: string;
  /** Extra classes for the header row (e.g. room for a dialog close button). */
  headerClassName?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const lines = React.useMemo(() => content.split("\n"), [content]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — leave the button idle */
    }
  };

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden border border-border bg-background",
        className
      )}
    >
      <div className={cn("flex min-h-11 items-center justify-between gap-3 border-b border-border bg-card px-3 py-2", headerClassName)}>
        <div className="flex min-w-0 items-center gap-2">
          <FileCode2 className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <span className="truncate font-mono text-[12.5px] font-medium">{path}</span>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">
            {languageFromPath(path)}
          </span>
          {similarity != null && (
            <span className="border border-border bg-card px-1.5 py-0.5 font-mono text-[11px] tabular text-success">
              {Math.round(similarity * 100)}% match
            </span>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 border border-border bg-card px-1.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            aria-label={copied ? "Copied" : "Copy code"}
          >
            {copied ? (
              <Check className="h-3 w-3 text-success" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <pre className="flex min-w-max px-0 py-3 font-mono text-[12.5px] leading-[1.7]">
          <code aria-hidden className="sticky left-0 select-none bg-background pr-3 pl-3 text-right text-muted-foreground/50">
            {lines.map((_, i) => (
              <span key={i} className="block">
                {i + 1}
              </span>
            ))}
          </code>
          <code className="pr-4 whitespace-pre text-foreground/90">{content}</code>
        </pre>
      </div>
    </div>
  );
}
