// Central place that reads and validates the Supabase environment
// variables (task 1.2: "Set up Supabase client with environment
// variables"). Every client factory in this directory goes through here so
// a missing variable fails fast with a clear message instead of a cryptic
// "Invalid URL" error deep inside supabase-js.

export interface SupabasePublicEnv {
  url: string;
  anonKey: string;
}

export function getSupabasePublicEnv(): SupabasePublicEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const missing: string[] = [];
  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!anonKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (missing.length > 0) {
    throw new Error(
      `Missing required Supabase environment variable(s): ${missing.join(", ")}. See .env.example.`,
    );
  }

  return { url: url as string, anonKey: anonKey as string };
}

/**
 * The service role key bypasses Row Level Security entirely. Only ever use
 * it in trusted server-only code (e.g. writing audit_logs, admin data
 * export/deletion jobs) — never send it to the browser.
 */
export function getSupabaseServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "Missing required Supabase environment variable: SUPABASE_SERVICE_ROLE_KEY. See .env.example.",
    );
  }
  return key;
}
