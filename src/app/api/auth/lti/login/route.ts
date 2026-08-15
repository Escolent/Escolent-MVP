import { NextResponse, type NextRequest } from "next/server";
import { AUTH_ERROR_CODES, AuthError, toErrorRedirect } from "@/lib/api/errors";
import { SupabaseAuthDataStore } from "@/lib/auth/supabaseDataStore";
import { buildAuthRequestUrl, generateStateAndNonce, type LtiLoginRequest } from "@/lib/auth/lti/oidc";
import { PENDING_LOGIN_COOKIE } from "@/lib/auth/lti/pendingLoginCookie";

async function readLtiLoginRequest(request: NextRequest): Promise<LtiLoginRequest> {
  const params =
    request.method === "POST"
      ? new URLSearchParams(await request.text())
      : request.nextUrl.searchParams;

  const iss = params.get("iss");
  const loginHint = params.get("login_hint");
  const targetLinkUri = params.get("target_link_uri");
  if (!iss || !loginHint || !targetLinkUri) {
    throw new AuthError(
      AUTH_ERROR_CODES.INVALID_LTI_JWT,
      "Your LMS did not send a complete sign-in request.",
      400,
    );
  }

  return {
    iss,
    loginHint,
    targetLinkUri,
    clientId: params.get("client_id") ?? undefined,
    // Both Canvas and Moodle send this on the login-init request in
    // practice, even though the LTI core spec doesn't strictly mandate it
    // at this step — Escolent requires it to disambiguate which of a
    // Platform's (possibly several) registered deployments this is.
    ltiDeploymentId: params.get("lti_deployment_id") ?? undefined,
    ltiMessageHint: params.get("lti_message_hint") ?? undefined,
  };
}

async function handleLogin(request: NextRequest): Promise<NextResponse> {
  let loginRequest: LtiLoginRequest;
  try {
    loginRequest = await readLtiLoginRequest(request);
  } catch (err) {
    if (err instanceof AuthError) return toErrorRedirect(err, request.url);
    throw err;
  }

  if (!loginRequest.ltiDeploymentId) {
    return toErrorRedirect(
      new AuthError(
        AUTH_ERROR_CODES.UNKNOWN_LMS_DEPLOYMENT,
        "Your LMS did not identify which deployment this sign-in is for.",
        400,
      ),
      request.url,
    );
  }

  const dataStore = new SupabaseAuthDataStore();
  const lmsConfig = await dataStore.findLmsConfigByIssuerAndDeployment(
    loginRequest.iss,
    loginRequest.ltiDeploymentId,
  );
  if (!lmsConfig) {
    return toErrorRedirect(
      new AuthError(
        AUTH_ERROR_CODES.UNKNOWN_LMS_DEPLOYMENT,
        "This LMS deployment is not registered with Escolent.",
        401,
      ),
      request.url,
    );
  }

  // SameSite=None is required below because the Platform's response
  // (/api/auth/lti/launch) arrives via a cross-site POST navigation (LTI
  // mandates response_mode=form_post) — Lax/Strict cookies don't survive that.
  const { state, nonce } = generateStateAndNonce();
  const redirectUri = new URL("/api/auth/lti/launch", request.url).toString();
  const authUrl = buildAuthRequestUrl({
    request: loginRequest,
    authLoginUrl: lmsConfig.authLoginUrl,
    clientId: lmsConfig.clientId,
    redirectUri,
    state,
    nonce,
  });

  const response = NextResponse.redirect(authUrl, { status: 303 });
  response.cookies.set(
    PENDING_LOGIN_COOKIE,
    JSON.stringify({ state, nonce, targetLinkUri: loginRequest.targetLinkUri }),
    {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/api/auth/lti",
      maxAge: 300, // the whole login->launch round trip should take seconds, not minutes
    },
  );
  return response;
}

export async function POST(request: NextRequest) {
  return handleLogin(request);
}

// Some Platforms send the OIDC login-init request via GET rather than POST;
// LTI 1.3 permits either.
export async function GET(request: NextRequest) {
  return handleLogin(request);
}
