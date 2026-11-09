'use client';

import { Show, SignInButton, UserButton } from '@clerk/nextjs';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { authEnabled } from '@/lib/clerk';

/** Sign-in control. Renders a dev-mode marker when Clerk isn't configured. */
export function UserBar() {
  if (!authEnabled) {
    return (
      <Badge title="AUTH_MODE=dev: every request acts as the same local user">Dev mode</Badge>
    );
  }

  return (
    <>
      <Show when="signed-out">
        <SignInButton mode="modal">
          <Button variant="secondary" size="sm">
            Sign in
          </Button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </>
  );
}
