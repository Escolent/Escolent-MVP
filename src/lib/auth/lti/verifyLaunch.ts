import { jwtVerify, type JWTVerifyGetKey, type JWTPayload } from "jose";
import { AUTH_ERROR_CODES, AuthError } from "@/lib/api/errors";

export interface VerifyLtiJwtOptions {
  /** JWKS resolver — `createRemoteJWKSet(lmsConfig.jwksUrl)` in production,
   *  `createLocalJWKSet(...)` in tests. Keeping this injectable is what
   *  lets task 3.2's tests sign JWTs with a throwaway keypair and verify
   *  them without any network access. */
  jwks: JWTVerifyGetKey;
  issuer: string;
  audience: string; // LTI client_id
  /** Must match the nonce issued during /api/auth/lti/login (CSRF/replay protection). */
  expectedNonce: string;
}

/**
 * Verifies an LTI 1.3 id_token's signature, issuer, audience, expiry, and
 * nonce. Does NOT interpret LTI-specific claims (message_type,
 * deployment_id, roles, ...) — that's parseLtiLaunchClaims's job, kept
 * separate so signature-layer failures and claims-layer failures are
 * distinguishable (and independently testable).
 */
export async function verifyLtiLaunchJwt(
  idToken: string,
  options: VerifyLtiJwtOptions,
): Promise<JWTPayload> {
  let payload: JWTPayload;
  try {
    const result = await jwtVerify(idToken, options.jwks, {
      issuer: options.issuer,
      audience: options.audience,
    });
    payload = result.payload;
  } catch (err) {
    throw new AuthError(
      AUTH_ERROR_CODES.INVALID_LTI_JWT,
      "Your LTI launch could not be verified — the sign-in request may have expired or been tampered with.",
      401,
      { cause: err instanceof Error ? err.message : String(err) },
    );
  }

  if (payload.nonce !== options.expectedNonce) {
    throw new AuthError(
      AUTH_ERROR_CODES.INVALID_LTI_JWT,
      "Your LTI launch could not be verified — the sign-in request may have expired or been tampered with.",
      401,
      { cause: "nonce_mismatch" },
    );
  }

  return payload;
}
