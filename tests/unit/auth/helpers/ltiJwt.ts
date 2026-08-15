import { SignJWT, exportJWK, generateKeyPair, createLocalJWKSet, type JWTVerifyGetKey } from "jose";
import { LTI_CLAIM, LTI_ROLE_URI } from "@/lib/auth/lti/types";

export const TEST_ISSUER = "https://canvas.test.escolent.dev";
export const TEST_CLIENT_ID = "test-client-id";
export const TEST_DEPLOYMENT_ID = "test-deployment-1";
export const TEST_NONCE = "test-nonce-abc123";

export interface TestKeypair {
  jwksResolver: JWTVerifyGetKey;
  sign: (overrides?: SignLtiJwtOverrides) => Promise<string>;
}

export interface SignLtiJwtOverrides {
  issuer?: string;
  audience?: string;
  subject?: string;
  email?: string | null;
  name?: string | null;
  nonce?: string | null; // null = omit the nonce claim entirely
  deploymentId?: string | null;
  roles?: string[] | null;
  courseId?: string | null;
  expiresInSeconds?: number; // negative = already expired
  omitStandardClaims?: boolean; // for "missing required claim" tests
}

/** Generates a fresh RSA keypair and returns a signer + matching local JWKS resolver. */
export async function generateTestKeypair(kid = "test-key-1"): Promise<TestKeypair> {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = kid;
  publicJwk.alg = "RS256";
  const jwksResolver = createLocalJWKSet({ keys: [publicJwk] });

  const sign = async (overrides: SignLtiJwtOverrides = {}): Promise<string> => {
    const payload: Record<string, unknown> = {};

    if (!overrides.omitStandardClaims) {
      payload.email = overrides.email === undefined ? "student@teneo.school" : overrides.email;
      payload.name = overrides.name === undefined ? "Test Student" : overrides.name;
      payload[LTI_CLAIM.deploymentId] =
        overrides.deploymentId === undefined ? TEST_DEPLOYMENT_ID : overrides.deploymentId;
      payload[LTI_CLAIM.roles] =
        overrides.roles === undefined ? [LTI_ROLE_URI.learner] : overrides.roles;
      payload[LTI_CLAIM.context] = {
        id: overrides.courseId === undefined ? "course-123" : overrides.courseId,
        title: "Grade 8 Algebra",
      };
      payload[LTI_CLAIM.messageType] = "LtiResourceLinkRequest";
      payload[LTI_CLAIM.version] = "1.3.0";
    } else {
      // Explicit overrides still apply even when "omitting standard claims"
      // so a test can knock out ONE claim while keeping the rest.
      if (overrides.email !== undefined) payload.email = overrides.email;
      if (overrides.name !== undefined) payload.name = overrides.name;
      if (overrides.deploymentId !== undefined) payload[LTI_CLAIM.deploymentId] = overrides.deploymentId;
      if (overrides.roles !== undefined) payload[LTI_CLAIM.roles] = overrides.roles;
      if (overrides.courseId !== undefined) {
        payload[LTI_CLAIM.context] = { id: overrides.courseId, title: "Grade 8 Algebra" };
      }
    }

    const nonceValue = overrides.nonce === undefined ? TEST_NONCE : overrides.nonce;
    if (nonceValue !== null) payload.nonce = nonceValue;

    const expiresIn = overrides.expiresInSeconds ?? 300;
    const now = Math.floor(Date.now() / 1000);

    return new SignJWT(payload)
      .setProtectedHeader({ alg: "RS256", kid })
      .setIssuer(overrides.issuer === undefined ? TEST_ISSUER : overrides.issuer)
      .setAudience(overrides.audience === undefined ? TEST_CLIENT_ID : overrides.audience)
      .setSubject(overrides.subject === undefined ? "lti-user-42" : overrides.subject)
      .setIssuedAt(now)
      .setExpirationTime(now + expiresIn)
      .sign(privateKey);
  };

  return { jwksResolver, sign };
}
