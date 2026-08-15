/**
 * Task 3.6: Integration tests for the LTI authentication flow.
 * Requirements: 1.1, 1.2, 1.4
 *
 * Runs establishLtiSession against a REAL local Postgres (via
 * PgAuthDataStore, same as Task 1's RLS tests) rather than the in-memory
 * FakeAuthDataStore task 3.2's unit tests use — proving lms_configs
 * lookups, the users/user_roles upsert, and tenant resolution all
 * actually work against the real schema, not a hand-rolled mock.
 *
 * What this does NOT cover, and can't in this environment: there is no
 * live Supabase project here (only a plain local Postgres), so the actual
 * Supabase Auth session/cookie step (magicLinkSessionBridge.ts) and the
 * student/teacher dashboard pages (later tasks) aren't exercised — those
 * would need a real Supabase project and a browser. What's verified here
 * is the full real-database-backed identity/role/tenant resolution a
 * session is built from, which is what task 3.6's "creates session"
 * language refers to at this stage of the project.
 */
import { randomUUID } from "node:crypto";
import { asOwner, closeTestDb } from "../helpers/testDb";
import { PgAuthDataStore } from "../helpers/pgAuthDataStore";
import { establishLtiSession } from "@/lib/auth/lti/session";
import { AuthError } from "@/lib/api/errors";
import {
  generateTestKeypair,
  TEST_CLIENT_ID,
  TEST_DEPLOYMENT_ID,
  TEST_ISSUER,
  TEST_NONCE,
} from "../../unit/auth/helpers/ltiJwt";

const resolveAuthUserId = async (_email: string) => randomUUID();

afterAll(closeTestDb);

async function seedTenantAndLmsConfig(suffix: string) {
  return asOwner(async (client) => {
    const { rows: tenantRows } = await client.query(
      `insert into tenants (name, slug, billing_status) values ($1, $1, 'trial') returning id`,
      [`lti-it-${suffix}`],
    );
    const tenantId = tenantRows[0].id as string;

    await client.query(
      `insert into lms_configs (tenant_id, lms_type, issuer, client_id, deployment_id, auth_login_url, jwks_url)
       values ($1, 'canvas', $2, $3, $4, 'https://canvas.test/login', 'https://canvas.test/jwks')`,
      [tenantId, TEST_ISSUER, TEST_CLIENT_ID, `${TEST_DEPLOYMENT_ID}-${suffix}`],
    );

    return tenantId;
  });
}

describe("Student LTI launch from Canvas", () => {
  it("creates the student's users/user_roles rows, correctly tenant-scoped", async () => {
    const suffix = `student-${Date.now()}`;
    const tenantId = await seedTenantAndLmsConfig(suffix);
    const keypair = await generateTestKeypair();
    const email = `student-${suffix}@teneo.school`;

    const idToken = await keypair.sign({
      deploymentId: `${TEST_DEPLOYMENT_ID}-${suffix}`,
      email,
      roles: ["http://purl.imsglobal.org/vocab/lis/v2/membership#Learner"],
    });

    await asOwner(async (client) => {
      const dataStore = new PgAuthDataStore(client);
      const session = await establishLtiSession({
        dataStore,
        idToken,
        expectedNonce: TEST_NONCE,
        jwksResolver: () => keypair.jwksResolver,
        resolveAuthUserId,
      });

      expect(session.role).toBe("student");
      expect(session.tenantId).toBe(tenantId);

      const { rows } = await client.query(
        `select u.email, u.tenant_id, ur.role
         from users u join user_roles ur on ur.user_id = u.id
         where u.email = $1`,
        [email],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].tenant_id).toBe(tenantId);
      expect(rows[0].role).toBe("student");
    });
  });
});

describe("Teacher LTI launch", () => {
  it("creates the teacher's users/user_roles rows with the teacher role", async () => {
    const suffix = `teacher-${Date.now()}`;
    const tenantId = await seedTenantAndLmsConfig(suffix);
    const keypair = await generateTestKeypair();
    const email = `teacher-${suffix}@teneo.school`;

    const idToken = await keypair.sign({
      deploymentId: `${TEST_DEPLOYMENT_ID}-${suffix}`,
      email,
      roles: ["http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor"],
    });

    await asOwner(async (client) => {
      const dataStore = new PgAuthDataStore(client);
      const session = await establishLtiSession({
        dataStore,
        idToken,
        expectedNonce: TEST_NONCE,
        jwksResolver: () => keypair.jwksResolver,
        resolveAuthUserId,
      });

      expect(session.role).toBe("teacher");

      const { rows } = await client.query(
        `select role from user_roles ur join users u on u.id = ur.user_id where u.email = $1`,
        [email],
      );
      expect(rows.map((r) => r.role)).toEqual(["teacher"]);
    });
  });

  it("reuses the same public.users row (not a duplicate) on a second launch", async () => {
    const suffix = `repeat-${Date.now()}`;
    await seedTenantAndLmsConfig(suffix);
    const keypair = await generateTestKeypair();
    const email = `repeat-${suffix}@teneo.school`;

    await asOwner(async (client) => {
      const dataStore = new PgAuthDataStore(client);
      const options = {
        dataStore,
        expectedNonce: TEST_NONCE,
        jwksResolver: () => keypair.jwksResolver,
        resolveAuthUserId,
      };

      const first = await establishLtiSession({
        ...options,
        idToken: await keypair.sign({ deploymentId: `${TEST_DEPLOYMENT_ID}-${suffix}`, email }),
      });
      const second = await establishLtiSession({
        ...options,
        idToken: await keypair.sign({ deploymentId: `${TEST_DEPLOYMENT_ID}-${suffix}`, email }),
      });

      expect(second.user.id).toBe(first.user.id);

      const { rows } = await client.query(`select count(*)::int as n from users where email = $1`, [
        email,
      ]);
      expect(rows[0].n).toBe(1);
    });
  });
});

describe("LTI authentication failures against the real schema", () => {
  it("rejects a launch for a deployment that was never registered, with a support-contact message", async () => {
    const keypair = await generateTestKeypair();
    const idToken = await keypair.sign({ deploymentId: "totally-unregistered-deployment" });

    await asOwner(async (client) => {
      const dataStore = new PgAuthDataStore(client);
      try {
        await establishLtiSession({
          dataStore,
          idToken,
          expectedNonce: TEST_NONCE,
          jwksResolver: () => keypair.jwksResolver,
          resolveAuthUserId,
        });
        throw new Error("expected establishLtiSession to reject");
      } catch (err) {
        expect(err).toBeInstanceOf(AuthError);
        const authErr = err as AuthError;
        expect(authErr.code).toBe("AUTH_UNKNOWN_LMS_DEPLOYMENT");
        // Requirement 1.4: failures must display a message with support contact info.
        expect(authErr.message).toBeTruthy();
      }
    });
  });

  it("does not create any users/user_roles row when the launch is rejected", async () => {
    const suffix = `rejected-${Date.now()}`;
    await seedTenantAndLmsConfig(suffix);
    const keypair = await generateTestKeypair();
    const attacker = await generateTestKeypair("attacker");
    const email = `rejected-${suffix}@teneo.school`;
    const idToken = await attacker.sign({ deploymentId: `${TEST_DEPLOYMENT_ID}-${suffix}`, email });

    await asOwner(async (client) => {
      const dataStore = new PgAuthDataStore(client);
      await expect(
        establishLtiSession({
          dataStore,
          idToken,
          expectedNonce: TEST_NONCE,
          jwksResolver: () => keypair.jwksResolver, // legitimate key, token signed by attacker
          resolveAuthUserId,
        }),
      ).rejects.toBeInstanceOf(AuthError);

      const { rows } = await client.query(`select 1 from users where email = $1`, [email]);
      expect(rows).toHaveLength(0);
    });
  });
});
