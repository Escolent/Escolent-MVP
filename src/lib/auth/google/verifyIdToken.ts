import { jwtVerify, createRemoteJWKSet, type JWTVerifyGetKey, type JWTPayload } from "jose";
import { AUTH_ERROR_CODES, AuthError } from "@/lib/api/errors";

export const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
export const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

let cachedJwks: JWTVerifyGetKey | undefined;
function defaultGoogleJwks(): JWTVerifyGetKey {
  if (!cachedJwks) cachedJwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
  return cachedJwks;
}

export interface GoogleClaims {
  subject: string;
  email: string;
  fullName: string | null;
  /** Google Workspace hosted domain (e.g. "teneo.school") — absent for personal @gmail.com accounts. */
  hostedDomain: string | null;
}

export interface VerifyGoogleIdTokenOptions {
  audience: string; // configured Google OAuth client_id
  /** Injectable so tests can supply a local JWKS instead of fetching Google's real one. */
  jwks?: JWTVerifyGetKey;
}

function invalidTokenError(cause: string): AuthError {
  return new AuthError(
    AUTH_ERROR_CODES.INVALID_GOOGLE_TOKEN,
    "Your Google sign-in could not be verified — the sign-in request may have expired or been tampered with.",
    401,
    { cause },
  );
}

export async function verifyGoogleIdToken(
  idToken: string,
  options: VerifyGoogleIdTokenOptions,
): Promise<GoogleClaims> {
  let payload: JWTPayload;
  try {
    const result = await jwtVerify(idToken, options.jwks ?? defaultGoogleJwks(), {
      issuer: GOOGLE_ISSUERS,
      audience: options.audience,
    });
    payload = result.payload;
  } catch (err) {
    throw invalidTokenError(err instanceof Error ? err.message : String(err));
  }

  if (!payload.sub) throw invalidTokenError("missing_claim:sub");
  const email = typeof payload.email === "string" ? payload.email : undefined;
  if (!email) throw invalidTokenError("missing_claim:email");
  if (payload.email_verified === false) throw invalidTokenError("email_not_verified");

  return {
    subject: payload.sub,
    email,
    fullName: typeof payload.name === "string" ? payload.name : null,
    hostedDomain: typeof payload.hd === "string" ? payload.hd : null,
  };
}
