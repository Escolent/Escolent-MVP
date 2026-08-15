import { SignJWT, exportJWK, generateKeyPair, createLocalJWKSet, type JWTVerifyGetKey } from "jose";

export const TEST_AUDIENCE = "test-google-client-id.apps.googleusercontent.com";

export interface SignGoogleIdTokenOverrides {
  issuer?: string;
  audience?: string;
  subject?: string;
  email?: string | null;
  emailVerified?: boolean;
  name?: string | null;
  hostedDomain?: string | null;
  expiresInSeconds?: number;
}

export interface TestGoogleKeypair {
  jwksResolver: JWTVerifyGetKey;
  sign: (overrides?: SignGoogleIdTokenOverrides) => Promise<string>;
}

export async function generateTestGoogleKeypair(kid = "google-test-key-1"): Promise<TestGoogleKeypair> {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = kid;
  publicJwk.alg = "RS256";
  const jwksResolver = createLocalJWKSet({ keys: [publicJwk] });

  const sign = async (overrides: SignGoogleIdTokenOverrides = {}): Promise<string> => {
    const payload: Record<string, unknown> = {};
    if (overrides.email !== undefined) {
      if (overrides.email !== null) payload.email = overrides.email;
    } else {
      payload.email = "teacher@teneo.school";
    }
    payload.email_verified = overrides.emailVerified ?? true;
    if (overrides.name !== undefined) {
      if (overrides.name !== null) payload.name = overrides.name;
    } else {
      payload.name = "Test Teacher";
    }
    if (overrides.hostedDomain !== undefined) {
      if (overrides.hostedDomain !== null) payload.hd = overrides.hostedDomain;
    } else {
      payload.hd = "teneo.school";
    }

    const expiresIn = overrides.expiresInSeconds ?? 300;
    const now = Math.floor(Date.now() / 1000);

    return new SignJWT(payload)
      .setProtectedHeader({ alg: "RS256", kid })
      .setIssuer(overrides.issuer === undefined ? "https://accounts.google.com" : overrides.issuer)
      .setAudience(overrides.audience === undefined ? TEST_AUDIENCE : overrides.audience)
      .setSubject(overrides.subject === undefined ? "google-user-123" : overrides.subject)
      .setIssuedAt(now)
      .setExpirationTime(now + expiresIn)
      .sign(privateKey);
  };

  return { jwksResolver, sign };
}
