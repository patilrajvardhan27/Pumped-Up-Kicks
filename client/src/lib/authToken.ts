/**
 * The API client is plain fetch and knows nothing about React, so Clerk's
 * session token is published here by a provider component and read by the
 * client when it builds a request.
 */
type TokenGetter = () => Promise<string | null>;

let getToken: TokenGetter | null = null;
let waiting: (() => void)[] = [];

export function setTokenGetter(fn: TokenGetter | null) {
  getToken = fn;
  if (fn) {
    waiting.forEach((resolve) => resolve());
    waiting = [];
  }
}

/** Resolves once a token getter is published, or after `ms` so a request never hangs. */
export function whenTokenReady(ms = 8000): Promise<void> {
  if (getToken) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      waiting = waiting.filter((each) => each !== done);
      resolve();
    }, ms);
    waiting.push(done);
  });
}

export async function currentToken(): Promise<string | null> {
  if (!getToken) return null;
  try {
    return await getToken();
  } catch {
    return null;
  }
}
