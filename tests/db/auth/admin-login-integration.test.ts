/**
 * Task 3.6: Integration test for Admin direct login.
 * Requirements: 1A.1, 1A.3
 *
 * The Supabase Auth password-verification step itself can't be exercised
 * without a live Supabase project (see the file header in
 * lti-launch-integration.test.ts for the same caveat) — fakePasswordAuthClient
 * stands in for it here, exactly as in the task 3.4 unit tests. What this
 * test adds beyond those unit tests is running the role check against a
 * REAL users/user_roles row in Postgres, seeded the way task 3.4's route
 * handler would actually encounter it (an Admin provisioned ahead of time
 * with a real tenant), rather than an in-memory fake.
 */
import { randomUUID } from "node:crypto";
import { asOwner, closeTestDb } from "../helpers/testDb";
import { PgAuthDataStore } from "../helpers/pgAuthDataStore";
import { loginAdmin } from "@/lib/auth/admin/login";
import { AuthError } from "@/lib/api/errors";
import { fakePasswordAuthClient } from "../../unit/auth/helpers/fakePasswordAuthClient";

afterAll(closeTestDb);

describe("Admin direct login against the real schema", () => {
  it("succeeds for a real Admin row and resolves their real tenant", async () => {
    const suffix = Date.now();
    const email = `admin-${suffix}@teneo.school`;

    await asOwner(async (client) => {
      const { rows: tenantRows } = await client.query(
        `insert into tenants (name, slug) values ($1, $1) returning id`,
        [`admin-it-${suffix}`],
      );
      const tenantId = tenantRows[0].id as string;
      const adminId = randomUUID();
      await client.query(
        `insert into users (id, tenant_id, email) values ($1, $2, $3)`,
        [adminId, tenantId, email],
      );
      await client.query(
        `insert into user_roles (user_id, role, tenant_id) values ($1, 'admin', $2)`,
        [adminId, tenantId],
      );

      const dataStore = new PgAuthDataStore(client);
      const result = await loginAdmin({
        dataStore,
        authClient: fakePasswordAuthClient({ userId: adminId }),
        email,
        password: "correct-password",
      });

      expect(result).toEqual({ userId: adminId, tenantId });
    });
  });

  it("rejects a real user who exists but was never granted the admin role", async () => {
    const suffix = Date.now();
    const email = `notadmin-${suffix}@teneo.school`;

    await asOwner(async (client) => {
      const { rows: tenantRows } = await client.query(
        `insert into tenants (name, slug) values ($1, $1) returning id`,
        [`notadmin-it-${suffix}`],
      );
      const tenantId = tenantRows[0].id as string;
      const userId = randomUUID();
      await client.query(`insert into users (id, tenant_id, email) values ($1, $2, $3)`, [
        userId,
        tenantId,
        email,
      ]);
      await client.query(
        `insert into user_roles (user_id, role, tenant_id) values ($1, 'teacher', $2)`,
        [userId, tenantId],
      );

      const dataStore = new PgAuthDataStore(client);
      await expect(
        loginAdmin({
          dataStore,
          authClient: fakePasswordAuthClient({ userId }),
          email,
          password: "correct-password",
        }),
      ).rejects.toMatchObject<Partial<AuthError>>({ code: "AUTH_INSUFFICIENT_PERMISSIONS" });
    });
  });
});
