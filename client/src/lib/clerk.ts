/**
 * Clerk is optional: with no publishable key the app runs in local dev mode,
 * where the API resolves every request to a single built-in user. This keeps
 * `npm run dev` working before anyone has signed up for Clerk.
 */
export const CLERK_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';

export const authEnabled = CLERK_PUBLISHABLE_KEY.length > 0;
