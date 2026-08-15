import { randomBytes } from "node:crypto";

export interface PendingGoogleLogin {
  csrf: string;
  courseId: string;
}

export function generateCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

export interface BuildGoogleAuthUrlParams {
  clientId: string;
  redirectUri: string;
  courseId: string;
  csrf: string;
}

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";

/**
 * Builds the redirect to Google's OAuth consent screen. `state` carries the
 * courseId (Google's OAuth callback has no other way to tell us which
 * Classroom course this launch is for — Requirement 1.3's role/course
 * lookup needs it) alongside the csrf token, verified against a cookie set
 * alongside this redirect (see /api/auth/google/login) the same way LTI's
 * `state` is verified against the pending-login cookie.
 */
export function buildGoogleAuthUrl(params: BuildGoogleAuthUrlParams): string {
  const url = new URL(GOOGLE_AUTH_ENDPOINT);
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set(
    "scope",
    "openid email profile https://www.googleapis.com/auth/classroom.rosters.readonly",
  );
  url.searchParams.set("access_type", "online");
  url.searchParams.set(
    "state",
    Buffer.from(JSON.stringify({ csrf: params.csrf, courseId: params.courseId })).toString(
      "base64url",
    ),
  );
  return url.toString();
}

export function parseGoogleStateParam(state: string): PendingGoogleLogin {
  const decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
  if (typeof decoded.csrf !== "string" || typeof decoded.courseId !== "string") {
    throw new Error("Malformed Google OAuth state parameter");
  }
  return decoded;
}
