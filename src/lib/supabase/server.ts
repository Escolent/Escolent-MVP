import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicEnv } from "./env";

/**
 * Supabase client for Server Components, Route Handlers, and Server
 * Actions — reads/writes the session via Next.js cookies so RLS policies
 * see the caller's real auth.uid(). Create a fresh client per request;
 * never share one across requests.
 */
export function createClient() {
  const cookieStore = cookies();
  const { url, anonKey } = getSupabasePublicEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component that can't set cookies — the
          // middleware below refreshes the session on every request instead.
        }
      },
    },
  });
}
