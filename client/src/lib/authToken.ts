/**
 * The API client is plain fetch and knows nothing about React, so Clerk's
 * session token is published here by a provider component and read by the
 * client when it builds a request.
 */
type TokenGetter = () => Promise<string | null>;

let getToken: TokenGetter | null = null;

export function setTokenGetter(fn: TokenGetter | null) {
  getToken = fn;
}

export async function currentToken(): Promise<string | null> {
  if (!getToken) return null;
  try {
    return await getToken();
  } catch {
    return null;
  }
}
