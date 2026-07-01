import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

/**
 * Next.js 16 proxy file (replaces deprecated middleware.ts).
 * 
 * Uses Clerk's middleware to protect authenticated routes.
 * Public routes (landing page, auth pages, webhooks) are explicitly excluded.
 * 
 * In Next.js 16, the "middleware" file convention is renamed to "proxy".
 * The Clerk clerkMiddleware function is compatible — we just re-export it
 * as the default export (proxy.ts supports default exports).
 */

// Routes that require authentication
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/repo(.*)',
  '/api/repo(.*)',
  '/api/chat(.*)',
  '/api/payments/checkout(.*)',
  '/api/payments/razorpay/verify(.*)',
]);

// Routes that must NOT be protected (webhooks, public pages)
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/shared(.*)',
  '/api/payments/stripe/webhook(.*)',
  '/api/payments/razorpay/webhook(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) {
    return; // Allow public access
  }

  if (isProtectedRoute(req)) {
    await auth.protect(); // Redirect to sign-in if not authenticated
  }
});

export const config = {
  // Match all routes except static files and Next.js internals
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/:path*',
  ],
};
