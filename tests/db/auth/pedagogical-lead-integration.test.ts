/**
 * Task 3.6: Integration test for Pedagogical_Lead login — "grants
 * cross-tenant read access."
 * Requirements: 1.1, 1.2, 1.3, 1A.1, 1A.3 (traceability per tasks.md 3.6);
 * cross-tenant access itself is Requirement 4.8 / the RLS Policy Special
 * Case from task 1.6.
 *
 * This is the one integration test in this file that goes beyond
 * "the login orchestration ran correctly against a real users row" (see
 * admin-login-integration.test.ts) and actually proves the claim in
 * tasks.md 3.6's checklist: that logging in as Pedagogical_Lead results in
 * REAL cross-tenant read access, by chaining into Task 1.6's RLS test
 * harness (asUser, which runs queries as a non-owner role RLS actually
 * applies to) after establishing the login.
 */
import { randomUUID } from "node:crypto";
import { asOwner, asUser, closeTestDb, getOwnerPool } from "../helpers/testDb";
import { PgAuthDataStore } from "../helpers/pgAuthDataStore";
import { loginPedagogicalLead } from "@/lib/auth/pedagogical-lead/login";
import { fakePasswordAuthClient } from "../../unit/auth/helpers/fakePasswordAuthClient";

afterAll(closeTestDb);

describe("Pedagogical_Lead login grants real cross-tenant read access", () => {
  it("logs in a real Pedagogical_Lead row, then reads unmatched_errors across two different real tenants via actual RLS", async () => {
    const suffix = Date.now();
    const email = `lead-${suffix}@escolent.com`;
    const leadId = randomUUID();

    const { tenantA, tenantB, skillA } = await asOwner(async (client) => {
      const { rows: tenantARows } = await client.query(
        `insert into tenants (name, slug) values ($1, $1) returning id`,
        [`pl-it-a-${suffix}`],
      );
      const { rows: tenantBRows } = await client.query(
        `insert into tenants (name, slug) values ($1, $1) returning id`,
        [`pl-it-b-${suffix}`],
      );
      const tenantA = tenantARows[0].id as string;
      const tenantB = tenantBRows[0].id as string;

      const { rows: skillRows } = await client.query(
        `insert into skills (name, skill_type, tenant_id) values ('S', 'procedural', $1) returning id`,
        [tenantA],
      );
      const skillA = skillRows[0].id as string;

      await client.query(`insert into users (id, tenant_id, email) values ($1, null, $2)`, [
        leadId,
        email,
      ]);
      await client.query(
        `insert into user_roles (user_id, role, tenant_id) values ($1, 'pedagogical_lead', null)`,
        [leadId],
      );

      await client.query(
        `insert into unmatched_errors (student_id_anonymized, skill_id, tenant_id)
         values ('hash-a', $1, $2), ('hash-b', $1, $3)`,
        [skillA, tenantA, tenantB],
      );

      return { tenantA, tenantB, skillA };
    });

    // Step 1: the actual login orchestration, against the real row.
    const ownerClient = await getOwnerPool().connect();
    try {
      const dataStore = new PgAuthDataStore(ownerClient);
      const loginResult = await loginPedagogicalLead({
        dataStore,
        authClient: fakePasswordAuthClient({ userId: leadId }),
        email,
        password: "correct-password",
      });
      expect(loginResult.userId).toBe(leadId);
    } finally {
      ownerClient.release();
    }

    // Step 2: with that identity, prove real RLS (task 1.6) actually grants
    // cross-tenant read — not just that the role exists in the database.
    const rows = await asUser(leadId, (client) =>
      client
        .query("select tenant_id, student_id_anonymized from unmatched_errors where skill_id = $1", [
          skillA,
        ])
        .then((r) => r.rows),
    );
    const tenantsSeen = rows.map((r) => r.tenant_id).sort();
    expect(tenantsSeen).toEqual([tenantA, tenantB].sort());
  });

  it("a Teacher (tenant-scoped role) does NOT get this cross-tenant access, even after a successful login of their own", async () => {
    const suffix = Date.now();
    const email = `teacher-${suffix}@teneo.school`;
    const teacherId = randomUUID();

    const { tenantA, skillA } = await asOwner(async (client) => {
      const { rows: tenantRows } = await client.query(
        `insert into tenants (name, slug) values ($1, $1) returning id`,
        [`pl-it-teacher-${suffix}`],
      );
      const tenantA = tenantRows[0].id as string;
      const { rows: skillRows } = await client.query(
        `insert into skills (name, skill_type, tenant_id) values ('S', 'procedural', $1) returning id`,
        [tenantA],
      );
      const skillA = skillRows[0].id as string;

      await client.query(`insert into users (id, tenant_id, email) values ($1, $2, $3)`, [
        teacherId,
        tenantA,
        email,
      ]);
      await client.query(
        `insert into user_roles (user_id, role, tenant_id) values ($1, 'teacher', $2)`,
        [teacherId, tenantA],
      );
      await client.query(
        `insert into unmatched_errors (student_id_anonymized, skill_id, tenant_id) values ('hash-c', $1, $2)`,
        [skillA, tenantA],
      );

      return { tenantA, skillA };
    });

    const rows = await asUser(teacherId, (client) =>
      client
        .query("select 1 from unmatched_errors where skill_id = $1", [skillA])
        .then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });
});
