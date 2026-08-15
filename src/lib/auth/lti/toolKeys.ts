import type { JWK } from "jose";

/**
 * Escolent's own keypair, published at GET /api/auth/lti/jwks. This is
 * distinct from the Platform (Canvas/Moodle) keys used to verify launch
 * id_tokens — those are looked up per-deployment via lms_configs.jwks_url.
 * This one is Escolent acting as the credentialed party, for LTI Advantage
 * service calls (Names and Roles Provisioning, etc.) where Escolent signs
 * a client_assertion JWT that the Platform verifies against this JWKS.
 * None of the MVP's Task 3 flows call those services yet, but the launch
 * flow's `POST /api/auth/lti/login` registration with a Platform requires
 * this endpoint to exist and return a well-formed JWKS regardless.
 *
 * Configured via LTI_TOOL_PRIVATE_JWK (a JSON-stringified private JWK).
 * Generate one with: `node -e "require('jose').generateKeyPair('RS256').then(async({privateKey})=>console.log(JSON.stringify(await require('jose').exportJWK(privateKey))))"`
 */
export function getToolPublicJwks(): { keys: JWK[] } {
  const raw = process.env.LTI_TOOL_PRIVATE_JWK;
  if (!raw) {
    throw new Error(
      "LTI_TOOL_PRIVATE_JWK is not configured — see src/lib/auth/lti/toolKeys.ts for how to generate one.",
    );
  }

  let privateJwk: JWK;
  try {
    privateJwk = JSON.parse(raw);
  } catch {
    throw new Error("LTI_TOOL_PRIVATE_JWK is not valid JSON.");
  }

  // Strip private-key material (RSA: d, p, q, dp, dq, qi) — never publish it.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { d, p, q, dp, dq, qi, ...publicOnly } = privateJwk;

  return {
    keys: [
      {
        ...publicOnly,
        kid: privateJwk.kid ?? "escolent-lti-1",
        alg: "RS256",
        use: "sig",
      },
    ],
  };
}
