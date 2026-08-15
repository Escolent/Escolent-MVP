import { generateKeyPair, exportJWK } from "jose";
import { getToolPublicJwks } from "@/lib/auth/lti/toolKeys";

describe("getToolPublicJwks", () => {
  const originalEnv = process.env.LTI_TOOL_PRIVATE_JWK;
  afterEach(() => {
    process.env.LTI_TOOL_PRIVATE_JWK = originalEnv;
  });

  it("publishes the public key material without leaking any private fields", async () => {
    const { privateKey } = await generateKeyPair("RS256", { extractable: true });
    const privateJwk = await exportJWK(privateKey);
    privateJwk.kid = "test-kid-1";
    process.env.LTI_TOOL_PRIVATE_JWK = JSON.stringify(privateJwk);

    const jwks = getToolPublicJwks();

    expect(jwks.keys).toHaveLength(1);
    const publicKey = jwks.keys[0];
    expect(publicKey.kid).toBe("test-kid-1");
    expect(publicKey.alg).toBe("RS256");
    expect(publicKey.use).toBe("sig");
    // RSA public components should be present...
    expect(publicKey.n).toBeDefined();
    expect(publicKey.e).toBeDefined();
    // ...but every private RSA component must never appear in the response.
    for (const privateField of ["d", "p", "q", "dp", "dq", "qi"]) {
      expect(publicKey).not.toHaveProperty(privateField);
    }
  });

  it("throws a clear error when unconfigured", () => {
    delete process.env.LTI_TOOL_PRIVATE_JWK;
    expect(() => getToolPublicJwks()).toThrow(/LTI_TOOL_PRIVATE_JWK/);
  });
});
