/**
 * Task 3.3: Create Google Classroom API authentication flow.
 * Requirements: 1.3, 1.4, 1.5
 */
import { randomUUID } from "node:crypto";
import { establishGoogleSession } from "@/lib/auth/google/session";
import type { FetchLike } from "@/lib/auth/google/classroom";
import { AuthError } from "@/lib/api/errors";
import { FakeAuthDataStore } from "./helpers/fakeAuthDataStore";
import { generateTestGoogleKeypair, TEST_AUDIENCE } from "./helpers/googleJwt";

const resolveAuthUserId = async (_email: string) => randomUUID();

function fakeClassroomFetch(role: "teacher" | "student" | null): FetchLike {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    const matchesRole = url.includes(`/${role}s/`);
    if (role && matchesRole) return new Response(null, { status: 200 });
    return new Response(null, { status: 404 });
  }) as FetchLike;
}

async function buildStore(tenantId = "22222222-2222-2222-2222-222222222222") {
  const store = new FakeAuthDataStore();
  const keypair = await generateTestGoogleKeypair();
  store.seedGoogleWorkspaceDomain("teneo.school", tenantId);
  return { store, keypair, tenantId };
}

describe("Google Classroom authentication", () => {
  it("creates a session for a valid Google ID token + course membership", async () => {
    const { store, keypair, tenantId } = await buildStore();
    const idToken = await keypair.sign();

    const result = await establishGoogleSession({
      dataStore: store,
      idToken,
      accessToken: "fake-access-token",
      courseId: "course-abc",
      audience: TEST_AUDIENCE,
      jwks: keypair.jwksResolver,
      fetchImpl: fakeClassroomFetch("teacher"),
      resolveAuthUserId,
    });

    expect(result.tenantId).toBe(tenantId);
    expect(result.role).toBe("teacher");
    expect(result.courseId).toBe("course-abc");
    expect(result.user.email).toBe("teacher@teneo.school");
    expect(await store.hasRole(result.user.id, "teacher")).toBe(true);
  });

  it("maps a student course membership to Escolent's student role", async () => {
    const { store, keypair } = await buildStore();
    const idToken = await keypair.sign({ email: "student@teneo.school" });

    const result = await establishGoogleSession({
      dataStore: store,
      idToken,
      accessToken: "fake-access-token",
      courseId: "course-abc",
      audience: TEST_AUDIENCE,
      jwks: keypair.jwksResolver,
      fetchImpl: fakeClassroomFetch("student"),
      resolveAuthUserId,
    });

    expect(result.role).toBe("student");
  });

  it("rejects a token signed with a different key (tampered signature)", async () => {
    const { store, keypair } = await buildStore();
    const attacker = await generateTestGoogleKeypair("attacker-key");
    const idToken = await attacker.sign();

    await expect(
      establishGoogleSession({
        dataStore: store,
        idToken,
        accessToken: "token",
        courseId: "course-abc",
        audience: TEST_AUDIENCE,
        jwks: keypair.jwksResolver,
        fetchImpl: fakeClassroomFetch("teacher"),
        resolveAuthUserId,
      }),
    ).rejects.toMatchObject<Partial<AuthError>>({ code: "AUTH_INVALID_GOOGLE_TOKEN" });
  });

  it("rejects an expired token", async () => {
    const { store, keypair } = await buildStore();
    const idToken = await keypair.sign({ expiresInSeconds: -60 });

    await expect(
      establishGoogleSession({
        dataStore: store,
        idToken,
        accessToken: "token",
        courseId: "course-abc",
        audience: TEST_AUDIENCE,
        jwks: keypair.jwksResolver,
        fetchImpl: fakeClassroomFetch("teacher"),
        resolveAuthUserId,
      }),
    ).rejects.toMatchObject<Partial<AuthError>>({ code: "AUTH_INVALID_GOOGLE_TOKEN" });
  });

  it("rejects a token issued for a different audience (client_id)", async () => {
    const { store, keypair } = await buildStore();
    const idToken = await keypair.sign({ audience: "someone-elses-client-id" });

    await expect(
      establishGoogleSession({
        dataStore: store,
        idToken,
        accessToken: "token",
        courseId: "course-abc",
        audience: TEST_AUDIENCE,
        jwks: keypair.jwksResolver,
        fetchImpl: fakeClassroomFetch("teacher"),
        resolveAuthUserId,
      }),
    ).rejects.toMatchObject<Partial<AuthError>>({ code: "AUTH_INVALID_GOOGLE_TOKEN" });
  });

  it("rejects an unverified email", async () => {
    const { store, keypair } = await buildStore();
    const idToken = await keypair.sign({ emailVerified: false });

    await expect(
      establishGoogleSession({
        dataStore: store,
        idToken,
        accessToken: "token",
        courseId: "course-abc",
        audience: TEST_AUDIENCE,
        jwks: keypair.jwksResolver,
        fetchImpl: fakeClassroomFetch("teacher"),
        resolveAuthUserId,
      }),
    ).rejects.toMatchObject<Partial<AuthError>>({ code: "AUTH_INVALID_GOOGLE_TOKEN" });
  });

  it("rejects a personal Google account with no Workspace domain (hd claim)", async () => {
    const { store, keypair } = await buildStore();
    const idToken = await keypair.sign({ hostedDomain: null, email: "someone@gmail.com" });

    await expect(
      establishGoogleSession({
        dataStore: store,
        idToken,
        accessToken: "token",
        courseId: "course-abc",
        audience: TEST_AUDIENCE,
        jwks: keypair.jwksResolver,
        fetchImpl: fakeClassroomFetch("teacher"),
        resolveAuthUserId,
      }),
    ).rejects.toMatchObject<Partial<AuthError>>({ code: "AUTH_UNKNOWN_GOOGLE_DOMAIN" });
  });

  it("rejects a Workspace domain that isn't registered with Escolent", async () => {
    const { store, keypair } = await buildStore();
    const idToken = await keypair.sign({ hostedDomain: "some-other-school.edu" });

    await expect(
      establishGoogleSession({
        dataStore: store,
        idToken,
        accessToken: "token",
        courseId: "course-abc",
        audience: TEST_AUDIENCE,
        jwks: keypair.jwksResolver,
        fetchImpl: fakeClassroomFetch("teacher"),
        resolveAuthUserId,
      }),
    ).rejects.toMatchObject<Partial<AuthError>>({ code: "AUTH_UNKNOWN_GOOGLE_DOMAIN" });
  });

  it("rejects a user who is neither a teacher nor a student of the course", async () => {
    const { store, keypair } = await buildStore();
    const idToken = await keypair.sign();

    await expect(
      establishGoogleSession({
        dataStore: store,
        idToken,
        accessToken: "token",
        courseId: "course-abc",
        audience: TEST_AUDIENCE,
        jwks: keypair.jwksResolver,
        fetchImpl: fakeClassroomFetch(null),
        resolveAuthUserId,
      }),
    ).rejects.toMatchObject<Partial<AuthError>>({ code: "AUTH_INSUFFICIENT_PERMISSIONS" });
  });

  it("extracts the correct tenant for the specific Workspace domain named — not just any registered tenant", async () => {
    const store = new FakeAuthDataStore();
    const keypair = await generateTestGoogleKeypair();
    const tenantA = "aaaaaaaa-0000-0000-0000-000000000000";
    const tenantB = "bbbbbbbb-0000-0000-0000-000000000000";
    store.seedGoogleWorkspaceDomain("school-a.edu", tenantA);
    store.seedGoogleWorkspaceDomain("school-b.edu", tenantB);

    const idToken = await keypair.sign({ hostedDomain: "school-b.edu", email: "t@school-b.edu" });

    const result = await establishGoogleSession({
      dataStore: store,
      idToken,
      accessToken: "token",
      courseId: "course-abc",
      audience: TEST_AUDIENCE,
      jwks: keypair.jwksResolver,
      fetchImpl: fakeClassroomFetch("teacher"),
      resolveAuthUserId,
    });

    expect(result.tenantId).toBe(tenantB);
    expect(result.tenantId).not.toBe(tenantA);
  });
});
