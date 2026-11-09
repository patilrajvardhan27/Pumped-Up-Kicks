'use client';

import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { authEnabled } from '@/lib/clerk';

/** Sign-in control. Renders a dev-mode marker when Clerk isn't configured. */
export function UserBar() {
  const yourData = (
    <ButtonLink href="/app/account" variant="tertiary" size="sm">
      Your data
    </ButtonLink>
  );

  if (!authEnabled) {
    return (
      <>
        {yourData}
        <Badge title="AUTH_MODE=dev: every request acts as the same local user">Dev mode</Badge>
      </>
    );
  }

  return (
    <>
      <SignedOut>
        <SignInButton mode="modal">
          <Button variant="secondary" size="sm">
            Sign in
          </Button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        {yourData}
        <UserButton />
      </SignedIn>
    </>
  );
}
