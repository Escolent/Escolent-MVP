/**
 * Task 3.2: Unit tests for LTI JWT validation and session creation.
 * Requirements: 1.1, 1.4
 */
import { randomUUID } from "node:crypto";
import { establishLtiSession } from "@/lib/auth/lti/session";
import { AuthError } from "@/lib/api/errors";
import { FakeAuthDataStore } from "./helpers/fakeAuthDataStore";
import {
  generateTestKeypair,
  TEST_CLIENT_ID,
  TEST_DEPLOYMENT_ID,
  TEST_ISSUER,
  TEST_NONCE,
} from "./helpers/ltiJwt";

// Stands in for the real "find or create Supabase Auth user" step
// (src/lib/auth/authAdmin.ts in production) — these tests are exercising
// JWT verification and claims mapping, not that Admin-API integration.
const resolveAuthUserId = async (_email: string) => randomUUID();

async function buildStore(tenantId = "11111111-1111-1111-1111-111111111111") {
  const store = new FakeAuthDataStore();
  const keypair = await generateTestKeypair();
  store.seedLmsConfig({
    tenantId,
    lmsType: "canvas",
    issuer: TEST_ISSUER,
    clientId: TEST_CLIENT_ID,
    deploymentId: TEST_DEPLOYMENT_ID,
    jwksUrl: "https://canvas.test.escolent.dev/jwks", // never fetched — jwksResolver overrides it
    authLoginUrl: "https://canvas.test.escolent.dev/oidc/login",
  });
  return { store, keypair, tenantId };
}

describe("LTI JWT validation and session creation", () => {
  it("creates a session for a valid LTI JWT", async () => {
    const { store, keypair, tenantId } = await buildStore();
    const idToken = await keypair.sign();

    const result = await establishLtiSession({
      dataStore: store,
      idToken,
      expectedNonce: TEST_NONCE,
      jwksResolver: () => keypair.jwksResolver,
      resolveAuthUserId,
    });

    expect(result.tenantId).toBe(tenantId);
    expect(result.role).toBe("student");
    expect(result.courseId).toBe("course-123");
    expect(result.user.email).toBe("student@teneo.school");

    // The user actually landed in the data store, tenant-scoped.
    const stored = await store.findUserByEmail("student@teneo.school");
    expect(stored?.tenantId).toBe(tenantId);
    expect(await store.hasRole(result.user.id, "student")).toBe(true);
  });

  it("rejects a JWT signed with a different key than the registered deployment's (tampered signature)", async () => {
    const { store, keypair } = await buildStore();
    const attackerKeypair = await generateTestKeypair("attacker-key");
    // Signed by someone who does NOT hold the platform's private key.
    const idToken = await attackerKeypair.sign();

    await expect(
      establishLtiSession({
        dataStore: store,
        idToken,
        expectedNonce: TEST_NONCE,
        // Verification uses the REGISTERED (legitimate) key, not the attacker's.
        jwksResolver: () => keypair.jwksResolver,
        resolveAuthUserId,
      }),
    ).rejects.toMatchObject<Partial<AuthError>>({
      code: "AUTH_INVALID_LTI_JWT",
    });
  });

  it("rejects an expired JWT", async () => {
    const { store, keypair } = await buildStore();
    const idToken = await keypair.sign({ expiresInSeconds: -60 });

    await expect(
      establishLtiSession({
        dataStore: store,
        idToken,
        expectedNonce: TEST_NONCE,
        jwksResolver: () => keypair.jwksResolver,
        resolveAuthUserId,
      }),
    ).rejects.toMatchObject<Partial<AuthError>>({
      code: "AUTH_INVALID_LTI_JWT",
    });
  });

  it("rejects a JWT whose nonce doesn't match the one issued at login (replay/CSRF protection)", async () => {
    const { store, keypair } = await buildStore();
    const idToken = await keypair.sign({ nonce: "a-different-nonce" });

    await expect(
      establishLtiSession({
        dataStore: store,
        idToken,
        expectedNonce: TEST_NONCE,
        jwksResolver: () => keypair.jwksResolver,
        resolveAuthUserId,
      }),
    ).rejects.toMatchObject<Partial<AuthError>>({
      code: "AUTH_INVALID_LTI_JWT",
    });
  });

  describe.each([
    ["email", { email: null }],
    ["deployment_id", { deploymentId: null }],
    ["roles", { roles: null }],
    ["context (course)", { courseId: null }],
  ] as const)("missing required claim: %s", (_name, overrides) => {
    it("is rejected rather than silently defaulted", async () => {
      const { store, keypair } = await buildStore();
      const idToken = await keypair.sign({ omitStandardClaims: true, ...overrides });

      await expect(
        establishLtiSession({
          dataStore: store,
          idToken,
          expectedNonce: TEST_NONCE,
          jwksResolver: () => keypair.jwksResolver,
          resolveAuthUserId,
        }),
      ).rejects.toMatchObject<Partial<AuthError>>({
        code: "AUTH_INVALID_LTI_JWT",
      });
    });
  });

  it("rejects a JWT with a role that isn't Learner or Instructor", async () => {
    const { store, keypair } = await buildStore();
    const idToken = await keypair.sign({
      roles: ["http://purl.imsglobal.org/vocab/lis/v2/institution/person#Guest"],
    });

    await expect(
      establishLtiSession({
        dataStore: store,
        idToken,
        expectedNonce: TEST_NONCE,
        jwksResolver: () => keypair.jwksResolver,
        resolveAuthUserId,
      }),
    ).rejects.toMatchObject<Partial<AuthError>>({ code: "AUTH_INVALID_LTI_JWT" });
  });

  it("extracts the correct tenant_id for the specific deployment the JWT names — not just any registered tenant", async () => {
    const store = new FakeAuthDataStore();
    const keypair = await generateTestKeypair();

    const tenantA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const tenantB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    store.seedLmsConfig({
      tenantId: tenantA,
      lmsType: "canvas",
      issuer: TEST_ISSUER,
      clientId: TEST_CLIENT_ID,
      deploymentId: "deployment-for-school-a",
      jwksUrl: "https://irrelevant/jwks",
      authLoginUrl: "https://irrelevant/login",
    });
    store.seedLmsConfig({
      tenantId: tenantB,
      lmsType: "canvas",
      issuer: TEST_ISSUER,
      clientId: TEST_CLIENT_ID,
      deploymentId: "deployment-for-school-b",
      jwksUrl: "https://irrelevant/jwks",
      authLoginUrl: "https://irrelevant/login",
    });

    const idToken = await keypair.sign({ deploymentId: "deployment-for-school-b" });

    const result = await establishLtiSession({
      dataStore: store,
      idToken,
      expectedNonce: TEST_NONCE,
      jwksResolver: () => keypair.jwksResolver,
      resolveAuthUserId,
    });

    expect(result.tenantId).toBe(tenantB);
    expect(result.tenantId).not.toBe(tenantA);
  });

  it("rejects a launch from a deployment that isn't registered with Escolent at all", async () => {
    const { store, keypair } = await buildStore();
    const idToken = await keypair.sign({ deploymentId: "some-unregistered-deployment" });

    await expect(
      establishLtiSession({
        dataStore: store,
        idToken,
        expectedNonce: TEST_NONCE,
        jwksResolver: () => keypair.jwksResolver,
        resolveAuthUserId,
      }),
    ).rejects.toMatchObject<Partial<AuthError>>({ code: "AUTH_UNKNOWN_LMS_DEPLOYMENT" });
  });

  it("maps the Instructor role to Escolent's teacher role", async () => {
    const { store, keypair } = await buildStore();
    const idToken = await keypair.sign({
      roles: ["http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor"],
      email: "teacher@teneo.school",
    });

    const result = await establishLtiSession({
      dataStore: store,
      idToken,
      expectedNonce: TEST_NONCE,
      jwksResolver: () => keypair.jwksResolver,
      resolveAuthUserId,
    });

    expect(result.role).toBe("teacher");
  });
});
