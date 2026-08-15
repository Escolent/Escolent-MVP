import { NextResponse, type NextRequest } from "next/server";
import { AUTH_ERROR_CODES, AuthError, toErrorRedirect } from "@/lib/api/errors";
import { getGoogleOAuthClientId } from "@/lib/auth/google/env";
import { buildGoogleAuthUrl, generateCsrfToken } from "@/lib/auth/google/oauthUrl";
import { GOOGLE_PENDING_LOGIN_COOKIE } from "@/lib/auth/google/pendingLoginCookie";

// Not one of design.md's two explicitly-listed Google endpoints
// (GET /callback, POST /launch) — but /callback has no other way to be
// reached: something has to redirect the browser to Google's consent
// screen first, carrying which Classroom course this launch is for (see
// the comment on buildGoogleAuthUrl). This is that redirect step, the
// Google-flow analogue of /api/auth/lti/login.
export async function GET(request: NextRequest) {
  const courseId = request.nextUrl.searchParams.get("courseId");
  if (!courseId) {
    return toErrorRedirect(
      new AuthError(
        AUTH_ERROR_CODES.UNKNOWN_GOOGLE_DOMAIN,
        "Missing which Google Classroom course this sign-in is for.",
        400,
      ),
      request.url,
    );
  }

  const csrf = generateCsrfToken();
  const redirectUri = new URL("/api/auth/google/callback", request.url).toString();
  const authUrl = buildGoogleAuthUrl({
    clientId: getGoogleOAuthClientId(),
    redirectUri,
    courseId,
    csrf,
  });

  const response = NextResponse.redirect(authUrl, { status: 303 });
  response.cookies.set(GOOGLE_PENDING_LOGIN_COOKIE, csrf, {
    httpOnly: true,
    secure: true,
    sameSite: "lax", // Google's redirect back is a top-level GET, unlike LTI's form_post
    path: "/api/auth/google",
    maxAge: 300,
  });
  return response;
}
