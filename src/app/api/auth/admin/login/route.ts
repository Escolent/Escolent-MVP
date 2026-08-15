import { NextResponse, type NextRequest } from "next/server";
import { AUTH_ERROR_CODES, AuthError, toErrorResponse } from "@/lib/api/errors";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseAuthDataStore } from "@/lib/auth/supabaseDataStore";
import { loginAdmin } from "@/lib/auth/admin/login";

export async function POST(request: NextRequest) {
  try {
    let body: { email?: unknown; password?: unknown };
    try {
      body = await request.json();
    } catch {
      throw new AuthError(AUTH_ERROR_CODES.INVALID_CREDENTIALS, "Missing or malformed request body.", 400);
    }
    if (typeof body.email !== "string" || typeof body.password !== "string") {
      throw new AuthError(AUTH_ERROR_CODES.INVALID_CREDENTIALS, "Email and password are required.", 400);
    }

    // The request-scoped SSR client — signInWithPassword writes the
    // session cookies via Next's cookie store directly on this response.
    const authClient = createServerSupabaseClient();
    const dataStore = new SupabaseAuthDataStore();

    const result = await loginAdmin({
      dataStore,
      authClient,
      email: body.email,
      password: body.password,
    });

    return NextResponse.json({ redirectTo: "/admin/dashboard", tenantId: result.tenantId });
  } catch (err) {
    if (err instanceof AuthError) return toErrorResponse(err);
    throw err;
  }
}
