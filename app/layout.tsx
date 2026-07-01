import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DevAsk — Understand Any Codebase in Minutes",
  description:
    "Paste a GitHub repo URL and chat with your codebase using AI. Full RAG indexing, multi-turn conversations, source-file citations. No IDE, no setup, just a URL.",
  keywords: [
    "codebase chat",
    "GitHub AI",
    "code understanding",
    "RAG",
    "developer tools",
    "code analysis",
  ],
  openGraph: {
    title: "DevAsk — Understand Any Codebase in Minutes",
    description:
      "Paste a GitHub repo URL and have a meaningful conversation with any codebase using AI.",
    type: "website",
  },
};

/**
 * Root layout wraps the entire app with:
 * 1. ClerkProvider — authentication context
 * 2. Geist fonts — the Nova theme's default typography
 * 3. Dark mode — applied by default via className="dark" on <html>
 * 
 * Note: The Providers component (TanStack Query) is added in dashboard/repo
 * layouts only, since the landing page doesn't need it.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        theme: shadcn,
      }}
    >
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
        suppressHydrationWarning
      >
        <body className="min-h-full flex flex-col bg-background text-foreground">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
