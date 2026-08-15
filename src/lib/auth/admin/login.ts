import { AUTH_ERROR_CODES, AuthError } from "@/lib/api/errors";
import type { AuthDataStore } from "../dataStore";

/**
 * The minimal surface loginAdmin needs from a Supabase client — kept as an
 * interface (rather than importing the full SupabaseClient type) so tests
 * can supply a lightweight fake instead of standing up a real client.
 */
export interface PasswordAuthClient {
  auth: {
    signInWithPassword(credentials: { email: string; password: string }): Promise<{
      data: { user: { id: string } | null };
      error: { message: string } | null;
    }>;
    signOut(): Promise<{ error: { message: string } | null }>;
  };
}

export interface AdminLoginOptions {
  dataStore: AuthDataStore;
  /** The request-scoped SSR client — signInWithPassword here is what
   *  actually writes the session cookies via Next's cookie store. */
  authClient: PasswordAuthClient;
  email: string;
  password: string;
}

export interface AdminLoginResult {
  userId: string;
  tenantId: string | null;
}

/**
 * Task 3.4: Admin direct login. Requirement 1A.2 allows SSO or username/
 * password; this implements the password path via Supabase Auth directly
 * (SSO providers are configured Supabase-side, not re-implemented here).
 *
 * Critically, a valid Supabase Auth login is NOT sufficient — Requirement
 * 1A itself is about a login interface *for Admins specifically*, so
 * anyone who authenticates here but doesn't hold the `admin` role gets
 * signed back out immediately rather than left with a live session for a
 * role this endpoint didn't intend to authenticate.
 */
export async function loginAdmin(options: AdminLoginOptions): Promise<AdminLoginResult> {
  const { data, error } = await options.authClient.auth.signInWithPassword({
    email: options.email,
    password: options.password,
  });

  if (error || !data.user) {
    throw new AuthError(AUTH_ERROR_CODES.INVALID_CREDENTIALS, "Incorrect email or password.", 401);
  }

  const isAdmin = await options.dataStore.hasRole(data.user.id, "admin");
  if (!isAdmin) {
    await options.authClient.auth.signOut();
    throw new AuthError(
      AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
      "This account does not have Admin access.",
      403,
    );
  }

  const user = await options.dataStore.findUserByEmail(options.email);
  return { userId: data.user.id, tenantId: user?.tenantId ?? null };
}
