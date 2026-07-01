import { SignIn } from '@clerk/nextjs';

/**
 * Sign-in page using Clerk's pre-built SignIn component.
 * GitHub OAuth is configured as the primary provider in the Clerk dashboard.
 * 
 * Using a catch-all route [[...sign-in]] as recommended by Clerk docs
 * to handle all sign-in related sub-routes (e.g., /sign-in/factor-one).
 */
export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md">
        <SignIn
          appearance={{
            elements: {
              rootBox: 'mx-auto',
              card: 'bg-card border border-border shadow-xl shadow-black/20',
              headerTitle: 'text-foreground',
              headerSubtitle: 'text-muted-foreground',
              formButtonPrimary: 'bg-primary hover:bg-primary/80',
              footerActionLink: 'text-primary hover:text-primary/80',
            },
          }}
        />
      </div>
    </main>
  );
}
