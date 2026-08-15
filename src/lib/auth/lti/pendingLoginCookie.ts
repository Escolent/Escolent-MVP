// Shared between /api/auth/lti/login and /api/auth/lti/launch. Kept out of
// the route files themselves since Next.js statically analyzes route.ts
// exports and only expects HTTP-method handlers and a small set of config
// exports there.
export const PENDING_LOGIN_COOKIE = "escolent_lti_pending";

export interface PendingLtiLogin {
  state: string;
  nonce: string;
  targetLinkUri: string;
}
