import { NextResponse, type NextRequest } from "next/server";
import { AUTH_ERROR_CODES, AuthError, toErrorResponse } from "@/lib/api/errors";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseAuthDataStore } from "@/lib/auth/supabaseDataStore";
import { loginPedagogicalLead } from "@/lib/auth/pedagogical-lead/login";

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

    const authClient = createServerSupabaseClient();
    const dataStore = new SupabaseAuthDataStore();

    await loginPedagogicalLead({ dataStore, authClient, email: body.email, password: body.password });

    return NextResponse.json({ redirectTo: "/pedagogical-lead/dashboard" });
  } catch (err) {
    if (err instanceof AuthError) return toErrorResponse(err);
    throw err;
  }
}
