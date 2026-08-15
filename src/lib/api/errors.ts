import { NextResponse } from "next/server";

// design.md "Error Handling" — every API route returns this shape.
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export const AUTH_ERROR_CODES = {
  INVALID_LTI_JWT: "AUTH_INVALID_LTI_JWT",
  INVALID_GOOGLE_TOKEN: "AUTH_INVALID_GOOGLE_TOKEN",
  EXPIRED_SESSION: "AUTH_EXPIRED_SESSION",
  INSUFFICIENT_PERMISSIONS: "AUTH_INSUFFICIENT_PERMISSIONS",
  UNKNOWN_LMS_DEPLOYMENT: "AUTH_UNKNOWN_LMS_DEPLOYMENT",
  UNKNOWN_GOOGLE_DOMAIN: "AUTH_UNKNOWN_GOOGLE_DOMAIN",
  INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",
} as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];

/**
 * Thrown by auth-flow logic on any failure. Every one of these SHALL, per
 * Requirements 1.4 and 1A.5, surface to the user as a message that includes
 * support contact information — see SUPPORT_CONTACT_MESSAGE below and
 * `toErrorResponse()`, which appends it to every response body.
 */
export class AuthError extends Error {
  readonly code: AuthErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(code: AuthErrorCode, message: string, status = 401, details?: Record<string, unknown>) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const SUPPORT_CONTACT_MESSAGE =
  "If this keeps happening, contact Escolent support at support@escolent.com.";

export function toErrorResponse(err: AuthError): NextResponse<ApiErrorBody> {
  const body: ApiErrorBody = {
    error: {
      code: err.code,
      message: `${err.message} ${SUPPORT_CONTACT_MESSAGE}`,
      ...(err.details ? { details: err.details } : {}),
    },
  };
  return NextResponse.json(body, { status: err.status });
}

/**
 * For flows the LMS/IdP redirects the browser through directly (LTI
 * launch, Google callback) rather than a client-side fetch() — the caller
 * here isn't JS that can parse a JSON error body, it's a real page
 * navigation, so the failure has to land on an actual error page (which
 * carries the same support-contact messaging) instead.
 */
export function toErrorRedirect(err: AuthError, requestUrl: string | URL): NextResponse {
  const url = new URL("/auth/error", requestUrl);
  url.searchParams.set("code", err.code);
  url.searchParams.set("message", err.message);
  return NextResponse.redirect(url, { status: 303 });
}
