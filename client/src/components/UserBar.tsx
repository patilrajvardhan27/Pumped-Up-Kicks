'use client';

import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs';
import { authEnabled } from '@/lib/clerk';

/** Sign-in control. Renders a dev-mode marker when Clerk isn't configured. */
export default function UserBar() {
  if (!authEnabled) {
    return (
      <span
        className="rounded-full border border-line px-3 py-1.5 font-mono text-[0.65rem]
                   uppercase tracking-wider text-faint"
        title="AUTH_MODE=dev — every request acts as the same local user"
      >
        Dev mode
      </span>
    );
  }

  return (
    <>
      <SignedOut>
        <SignInButton mode="modal">
          <button className="btn-ghost text-sm">Sign in</button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <UserButton />
      </SignedIn>
    </>
  );
}
