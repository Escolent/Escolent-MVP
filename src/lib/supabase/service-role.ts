import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv, getSupabaseServiceRoleKey } from "./env";

/**
 * Supabase client authenticated with the service role key — bypasses RLS
 * entirely. Reserve this for trusted server-only operations that are
 * intentionally cross-tenant or system-authored (writing audit_logs rows,
 * the admin data export/deletion jobs, background jobs). Every call site
 * using this client is responsible for its own authorization checks, since
 * the database will no longer enforce tenant isolation for it.
 *
 * Never import this from a Client Component or expose it to the browser.
 */
export function createServiceRoleClient() {
  const { url } = getSupabasePublicEnv();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
