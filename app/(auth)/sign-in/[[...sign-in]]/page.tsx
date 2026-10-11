import { SignIn } from '@clerk/nextjs';
import { AuthShell } from '@/components/auth-shell';

/**
 * Sign-in page using Clerk's pre-built SignIn component.
 * GitHub OAuth is configured as the primary provider in the Clerk dashboard.
 *
 * Using a catch-all route [[...sign-in]] as recommended by Clerk docs
 * to handle all sign-in related sub-routes (e.g., /sign-in/factor-one).
 */
export default function SignInPage() {
  return (
    <AuthShell
      heading="Welcome back to your codebases."
      body="Your indexes and conversation history are waiting. Sign in to keep asking."
    >
      <SignIn
        appearance={{
          elements: {
            rootBox: 'mx-auto w-full',
            card: 'bg-card border border-border shadow-none w-full',
            headerTitle: 'text-foreground',
            headerSubtitle: 'text-muted-foreground',
            formButtonPrimary: 'bg-primary hover:bg-primary/85 text-primary-foreground',
            footerActionLink: 'text-signal hover:text-signal/80',
            formFieldInput: 'bg-background border-input',
          },
        }}
      />
    </AuthShell>
  );
}
