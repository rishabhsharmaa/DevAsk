import { SignUp } from '@clerk/nextjs';

/**
 * Sign-up page using Clerk's pre-built SignUp component.
 * GitHub OAuth is configured as the primary provider in the Clerk dashboard.
 */
export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md">
        <SignUp
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
