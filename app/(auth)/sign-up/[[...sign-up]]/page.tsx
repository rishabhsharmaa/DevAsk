import { SignUp } from '@clerk/nextjs';
import { AuthShell } from '@/components/auth-shell';

/**
 * Sign-up page using Clerk's pre-built SignUp component.
 * GitHub OAuth is configured as the primary provider in the Clerk dashboard.
 */
export default function SignUpPage() {
  return (
    <AuthShell
      heading="Understand any codebase in minutes."
      body="Create an account, paste a repository URL, and start asking. Free plan, no credit card."
    >
      <SignUp
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
