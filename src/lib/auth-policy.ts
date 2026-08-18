// Which identity providers are allowed to hold a session.
//
// The login screen only offers Google, but that is cosmetic: the Supabase Auth
// API is reachable directly with the anon key, which ships in the browser
// bundle by design. If the Email provider is enabled in the Supabase dashboard
// — it was, on the first production deploy — anyone can POST /auth/v1/signup
// and mint a working account without ever loading our page.
//
// So the app, not a dashboard toggle, is the enforcement point. A toggle can
// be flipped back by anyone with project access; this cannot drift silently.

/** Shape we need from a Supabase user. Kept structural so tests need no SDK. */
export interface ProviderIdentity {
  app_metadata?: {
    provider?: string;
    providers?: string[];
  };
}

export const ALLOWED_PROVIDERS = ["google"] as const;

export function isAllowedProvider(user: ProviderIdentity | null | undefined): boolean {
  if (!user) return false;
  const meta = user.app_metadata ?? {};
  const claimed = [meta.provider, ...(meta.providers ?? [])].filter(Boolean) as string[];
  // Every provider on the identity must be allowed. A user who linked Google
  // *and* a password still has a password to be phished or stuffed.
  return claimed.length > 0 && claimed.every((p) => ALLOWED_PROVIDERS.includes(p as "google"));
}

/**
 * Enforced in production only. The Playwright suite signs in with a password
 * through /api/test/login, which is itself 404 under NODE_ENV=production — so
 * the test path exists exclusively where this check is off.
 */
export function shouldEnforceProviderPolicy(): boolean {
  return process.env.NODE_ENV === "production";
}
