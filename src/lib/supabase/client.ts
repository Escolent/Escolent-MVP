"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "./env";

/**
 * Supabase client for Client Components. Safe to call repeatedly — RLS
 * (task 1.6) is what actually enforces tenant isolation, this client only
 * carries the anon key.
 */
export function createClient() {
  const { url, anonKey } = getSupabasePublicEnv();
  return createBrowserClient(url, anonKey);
}
