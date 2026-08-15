import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabasePublicEnv } from "./env";

/**
 * Refreshes the Supabase auth session on every request and keeps the
 * updated cookies in sync between the request and the response. Called
 * from the root middleware.ts. Without this, sessions in Server Components
 * silently go stale since Server Components cannot themselves write
 * cookies (see the catch block in ./server.ts).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey } = getSupabasePublicEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Revalidates the token if expired — required for Server Components,
  // which cannot themselves refresh it.
  await supabase.auth.getUser();

  return response;
}
