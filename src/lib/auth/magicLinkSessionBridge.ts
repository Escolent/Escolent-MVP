import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Bridges a verified external identity (LTI, Google Classroom) into a real
 * Supabase Auth session, without ever exposing a magic-link token to the
 * browser: generate the link server-side via the admin API, then
 * immediately redeem it server-side via verifyOtp on the request-scoped
 * SSR client, which writes the session cookies for us in one round trip.
 * Admin/Pedagogical_Lead sign in with an actual password instead (see
 * src/lib/auth/admin/login.ts) and don't need this.
 */
export async function establishMagicLinkSession(
  adminClient: SupabaseClient,
  serverClient: SupabaseClient,
  email: string,
): Promise<void> {
  const { data, error } = await adminClient.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error || !data.properties?.hashed_token) {
    throw error ?? new Error(`Failed to generate a session link for ${email}`);
  }

  const { error: verifyError } = await serverClient.auth.verifyOtp({
    type: "magiclink",
    token_hash: data.properties.hashed_token,
  });
  if (verifyError) throw verifyError;
}
