import { NextResponse, type NextRequest } from "next/server";
import { AUTH_ERROR_CODES, AuthError, toErrorRedirect } from "@/lib/api/errors";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseAuthDataStore } from "@/lib/auth/supabaseDataStore";
import { establishGoogleSession } from "@/lib/auth/google/session";
import { exchangeGoogleAuthCode } from "@/lib/auth/google/exchangeCode";
import { parseGoogleStateParam } from "@/lib/auth/google/oauthUrl";
import { getGoogleOAuthClientId, getGoogleOAuthClientSecret } from "@/lib/auth/google/env";
import { resolveAuthUserId } from "@/lib/auth/authAdmin";
import { establishMagicLinkSession } from "@/lib/auth/magicLinkSessionBridge";
import { GOOGLE_PENDING_LOGIN_COOKIE } from "@/lib/auth/google/pendingLoginCookie";

function invalidCallbackError(): AuthError {
  return new AuthError(
    AUTH_ERROR_CODES.INVALID_GOOGLE_TOKEN,
    "Your Google sign-in could not be verified — the sign-in request may have expired or been tampered with.",
    401,
  );
}

const DASHBOARD_PATH: Record<"student" | "teacher", string> = {
  student: "/student/dashboard",
  teacher: "/teacher/dashboard",
};

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    if (!code || !state) throw invalidCallbackError();

    const pendingCsrf = request.cookies.get(GOOGLE_PENDING_LOGIN_COOKIE)?.value;
    if (!pendingCsrf) throw invalidCallbackError();

    let parsedState;
    try {
      parsedState = parseGoogleStateParam(state);
    } catch {
      throw invalidCallbackError();
    }
    if (parsedState.csrf !== pendingCsrf) throw invalidCallbackError();

    const clientId = getGoogleOAuthClientId();
    const tokens = await exchangeGoogleAuthCode({
      code,
      clientId,
      clientSecret: getGoogleOAuthClientSecret(),
      redirectUri: new URL("/api/auth/google/callback", request.url).toString(),
    });

    const admin = createServiceRoleClient();
    const dataStore = new SupabaseAuthDataStore(admin);
    const session = await establishGoogleSession({
      dataStore,
      idToken: tokens.idToken,
      accessToken: tokens.accessToken,
      courseId: parsedState.courseId,
      audience: clientId,
      resolveAuthUserId: (email) => resolveAuthUserId(admin, email),
    });

    const serverClient = createServerSupabaseClient();
    await establishMagicLinkSession(admin, serverClient, session.user.email);

    const response = NextResponse.redirect(
      new URL(DASHBOARD_PATH[session.role], request.url),
      { status: 303 },
    );
    response.cookies.delete({ name: GOOGLE_PENDING_LOGIN_COOKIE, path: "/api/auth/google" });
    return response;
  } catch (err) {
    if (err instanceof AuthError) return toErrorRedirect(err, request.url);
    throw err;
  }
}
