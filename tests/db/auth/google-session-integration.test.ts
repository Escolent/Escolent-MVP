/**
 * Task 3.6: Integration test for the Google Classroom authentication flow.
 * Requirements: 1.3, 1.4
 *
 * Same shape as lti-launch-integration.test.ts: establishGoogleSession
 * against a REAL local Postgres via PgAuthDataStore, with only the parts
 * that need a live external service (Google's real JWKS, the real
 * Classroom API, Supabase Auth) stood in for — the database-backed tenant
 * resolution and user/role upsert are real.
 */
import { randomUUID } from "node:crypto";
import { asOwner, closeTestDb } from "../helpers/testDb";
import { PgAuthDataStore } from "../helpers/pgAuthDataStore";
import { establishGoogleSession } from "@/lib/auth/google/session";
import type { FetchLike } from "@/lib/auth/google/classroom";
import { generateTestGoogleKeypair, TEST_AUDIENCE } from "../../unit/auth/helpers/googleJwt";

const resolveAuthUserId = async (_email: string) => randomUUID();

function fakeClassroomFetch(role: "teacher" | "student"): FetchLike {
  return (async (input: RequestInfo | URL) =>
    String(input).includes(`/${role}s/`)
      ? new Response(null, { status: 200 })
      : new Response(null, { status: 404 })) as FetchLike;
}

afterAll(closeTestDb);

describe("Google Classroom launch against the real schema", () => {
  it("resolves the tenant from a real google_workspace_domains row and creates the user tenant-scoped", async () => {
    const suffix = Date.now();
    const domain = `teneo-${suffix}.school`;
    const email = `student-${suffix}@${domain}`;
    const keypair = await generateTestGoogleKeypair();

    const tenantId = await asOwner(async (client) => {
      const { rows } = await client.query(
        `insert into tenants (name, slug) values ($1, $1) returning id`,
        [`google-it-${suffix}`],
      );
      const tenantId = rows[0].id as string;
      await client.query(
        `insert into google_workspace_domains (tenant_id, domain) values ($1, $2)`,
        [tenantId, domain],
      );
      return tenantId;
    });

    const idToken = await keypair.sign({ hostedDomain: domain, email });

    await asOwner(async (client) => {
      const dataStore = new PgAuthDataStore(client);
      const session = await establishGoogleSession({
        dataStore,
        idToken,
        accessToken: "fake-access-token",
        courseId: "course-abc",
        audience: TEST_AUDIENCE,
        jwks: keypair.jwksResolver,
        fetchImpl: fakeClassroomFetch("student"),
        resolveAuthUserId,
      });

      expect(session.tenantId).toBe(tenantId);
      expect(session.role).toBe("student");

      const { rows } = await client.query(
        `select tenant_id from users where email = $1`,
        [email],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].tenant_id).toBe(tenantId);
    });
  });

  it("rejects a Workspace domain that has no registered tenant, creating no user row", async () => {
    const suffix = Date.now();
    const email = `nobody-${suffix}@unregistered-domain.edu`;
    const keypair = await generateTestGoogleKeypair();
    const idToken = await keypair.sign({ hostedDomain: "unregistered-domain.edu", email });

    await asOwner(async (client) => {
      const dataStore = new PgAuthDataStore(client);
      await expect(
        establishGoogleSession({
          dataStore,
          idToken,
          accessToken: "fake-access-token",
          courseId: "course-abc",
          audience: TEST_AUDIENCE,
          jwks: keypair.jwksResolver,
          fetchImpl: fakeClassroomFetch("student"),
          resolveAuthUserId,
        }),
      ).rejects.toMatchObject({ code: "AUTH_UNKNOWN_GOOGLE_DOMAIN" });

      const { rows } = await client.query(`select 1 from users where email = $1`, [email]);
      expect(rows).toHaveLength(0);
    });
  });
});
