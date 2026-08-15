import { NextResponse, type NextRequest } from "next/server";
import { AUTH_ERROR_CODES, AuthError, toErrorRedirect } from "@/lib/api/errors";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseAuthDataStore } from "@/lib/auth/supabaseDataStore";
import { establishLtiSession } from "@/lib/auth/lti/session";
import { resolveAuthUserId } from "@/lib/auth/authAdmin";
import { establishMagicLinkSession } from "@/lib/auth/magicLinkSessionBridge";
import { PENDING_LOGIN_COOKIE, type PendingLtiLogin } from "@/lib/auth/lti/pendingLoginCookie";

function malformedLaunchError(): AuthError {
  return new AuthError(
    AUTH_ERROR_CODES.INVALID_LTI_JWT,
    "Your LTI launch could not be verified — the sign-in request may have expired or been tampered with.",
    401,
  );
}

const DASHBOARD_PATH: Record<"student" | "teacher", string> = {
  student: "/student/dashboard",
  teacher: "/teacher/dashboard",
};

export async function POST(request: NextRequest) {
  try {
    const pendingCookie = request.cookies.get(PENDING_LOGIN_COOKIE)?.value;
    if (!pendingCookie) throw malformedLaunchError();

    let pending: PendingLtiLogin;
    try {
      pending = JSON.parse(pendingCookie);
    } catch {
      throw malformedLaunchError();
    }

    const form = new URLSearchParams(await request.text());
    const idToken = form.get("id_token");
    const state = form.get("state");
    if (!idToken || !state) throw malformedLaunchError();
    if (state !== pending.state) throw malformedLaunchError();

    const admin = createServiceRoleClient();
    const dataStore = new SupabaseAuthDataStore(admin);

    const session = await establishLtiSession({
      dataStore,
      idToken,
      expectedNonce: pending.nonce,
      resolveAuthUserId: (email) => resolveAuthUserId(admin, email),
    });

    const serverClient = createServerSupabaseClient();
    await establishMagicLinkSession(admin, serverClient, session.user.email);

    const response = NextResponse.redirect(
      new URL(DASHBOARD_PATH[session.role], request.url),
      { status: 303 },
    );
    response.cookies.delete({ name: PENDING_LOGIN_COOKIE, path: "/api/auth/lti" });
    return response;
  } catch (err) {
    if (err instanceof AuthError) return toErrorRedirect(err, request.url);
    throw err;
  }
}
