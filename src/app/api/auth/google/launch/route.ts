import { NextResponse, type NextRequest } from "next/server";
import { AUTH_ERROR_CODES, AuthError, toErrorResponse } from "@/lib/api/errors";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseAuthDataStore } from "@/lib/auth/supabaseDataStore";
import { establishGoogleSession } from "@/lib/auth/google/session";
import { getGoogleOAuthClientId } from "@/lib/auth/google/env";
import { resolveAuthUserId } from "@/lib/auth/authAdmin";
import { establishMagicLinkSession } from "@/lib/auth/magicLinkSessionBridge";

const DASHBOARD_PATH: Record<"student" | "teacher", string> = {
  student: "/student/dashboard",
  teacher: "/teacher/dashboard",
};

/**
 * Alternate entry point to the same session-establishment logic as
 * /api/auth/google/callback, for callers that already hold a Google
 * id_token + access_token client-side (e.g. a Classroom Add-on using
 * Google Identity Services directly) rather than going through the
 * server-side OAuth2 authorization-code redirect. Called via fetch, so it
 * responds with JSON (cookies are still set on the response) rather than
 * a redirect.
 */
export async function POST(request: NextRequest) {
  try {
    let body: { idToken?: unknown; accessToken?: unknown; courseId?: unknown };
    try {
      body = await request.json();
    } catch {
      throw new AuthError(
        AUTH_ERROR_CODES.INVALID_GOOGLE_TOKEN,
        "Missing or malformed request body.",
        400,
      );
    }

    if (
      typeof body.idToken !== "string" ||
      typeof body.accessToken !== "string" ||
      typeof body.courseId !== "string"
    ) {
      throw new AuthError(
        AUTH_ERROR_CODES.INVALID_GOOGLE_TOKEN,
        "Request must include idToken, accessToken, and courseId.",
        400,
      );
    }

    const admin = createServiceRoleClient();
    const dataStore = new SupabaseAuthDataStore(admin);
    const session = await establishGoogleSession({
      dataStore,
      idToken: body.idToken,
      accessToken: body.accessToken,
      courseId: body.courseId,
      audience: getGoogleOAuthClientId(),
      resolveAuthUserId: (email) => resolveAuthUserId(admin, email),
    });

    const serverClient = createServerSupabaseClient();
    await establishMagicLinkSession(admin, serverClient, session.user.email);

    return NextResponse.json({
      role: session.role,
      redirectTo: DASHBOARD_PATH[session.role],
    });
  } catch (err) {
    if (err instanceof AuthError) return toErrorResponse(err);
    throw err;
  }
}
