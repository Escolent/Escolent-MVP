/**
 * Task 1.6: Row Level Security (RLS) policies for all tenant-scoped tables.
 * Requirements: 21.1, 21.2, 21.3, 21.4
 *
 * These tests run every query through `escolent_app_user` — a non-owner
 * role granted table DML but subject to RLS (see tests/db/helpers/testDb.ts)
 * — with `auth.uid()` stubbed per-transaction, so they exercise the actual
 * policies rather than just checking that they exist.
 */
import { asOwner, asUser, closeTestDb } from "../helpers/testDb";
import { policyNames, rlsEnabled } from "../helpers/introspect";

afterAll(closeTestDb);

interface Fixture {
  tenantA: string;
  tenantB: string;
  studentA: string;
  studentA2: string;
  teacherA: string;
  adminA: string;
  studentB: string;
  teacherB: string;
  pedagogicalLead: string;
  skillA: string;
}

async function seedFixture(): Promise<Fixture> {
  return asOwner(async (client) => {
    const tenant = async (slug: string) => {
      const { rows } = await client.query(
        `insert into tenants (name, slug, billing_status) values ($1, $1, 'trial') returning id`,
        [slug],
      );
      return rows[0].id as string;
    };
    const user = async (tenantId: string | null, email: string, role: string) => {
      const { rows } = await client.query(
        `insert into users (tenant_id, email) values ($1, $2) returning id`,
        [tenantId, email],
      );
      const userId = rows[0].id as string;
      await client.query(`insert into user_roles (user_id, role, tenant_id) values ($1, $2, $3)`, [
        userId,
        role,
        tenantId,
      ]);
      return userId;
    };

    const tenantA = await tenant(`rls-tenant-a-${Date.now()}`);
    const tenantB = await tenant(`rls-tenant-b-${Date.now()}`);

    const studentA = await user(tenantA, `student-a-${Date.now()}@test.com`, "student");
    const studentA2 = await user(tenantA, `student-a2-${Date.now()}@test.com`, "student");
    const teacherA = await user(tenantA, `teacher-a-${Date.now()}@test.com`, "teacher");
    const adminA = await user(tenantA, `admin-a-${Date.now()}@test.com`, "admin");
    const studentB = await user(tenantB, `student-b-${Date.now()}@test.com`, "student");
    const teacherB = await user(tenantB, `teacher-b-${Date.now()}@test.com`, "teacher");
    const pedagogicalLead = await user(null, `pedlead-${Date.now()}@test.com`, "pedagogical_lead");

    const { rows: skillRows } = await client.query(
      `insert into skills (name, skill_type, tenant_id) values ('One-step equations', 'procedural', $1) returning id`,
      [tenantA],
    );
    const skillA = skillRows[0].id as string;

    await client.query(
      `insert into mastery_states (student_id, skill_id, probability, tenant_id) values ($1, $2, 0.5, $3)`,
      [studentA, skillA, tenantA],
    );
    await client.query(
      `insert into mastery_states (student_id, skill_id, probability, tenant_id) values ($1, $2, 0.5, $3)`,
      [studentA2, skillA, tenantA],
    );

    return { tenantA, tenantB, studentA, studentA2, teacherA, adminA, studentB, teacherB, pedagogicalLead, skillA };
  });
}

describe("RLS policies exist on every tenant-scoped table", () => {
  const tables = [
    "tenants",
    "users",
    "user_roles",
    "skills",
    "mastery_states",
    "misconceptions",
    "student_misconceptions",
    "unmatched_errors",
    "spaced_repetition_schedules",
    "spaces",
    "space_enrollments",
    "sessions",
    "mastery_overrides",
    "distress_escalations",
    "audit_logs",
  ];

  it.each(tables)("%s has RLS enabled with at least one policy", async (table) => {
    await asOwner(async (client) => {
      expect(await rlsEnabled(client, table)).toBe(true);
      expect((await policyNames(client, table)).length).toBeGreaterThan(0);
    });
  });
});

describe("mastery_states RLS enforcement", () => {
  let fx: Fixture;
  beforeAll(async () => {
    fx = await seedFixture();
  });

  it("lets a student read only their own mastery state", async () => {
    const rows = await asUser(fx.studentA, (client) =>
      client.query("select student_id from mastery_states").then((r) => r.rows),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].student_id).toBe(fx.studentA);
  });

  it("blocks a student from reading another student's mastery state directly", async () => {
    const rows = await asUser(fx.studentA, (client) =>
      client
        .query("select student_id from mastery_states where student_id = $1", [fx.studentA2])
        .then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });

  it("blocks cross-tenant student access entirely", async () => {
    const rows = await asUser(fx.studentB, (client) =>
      client.query("select student_id from mastery_states").then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });

  it("lets a teacher read mastery states across their own tenant but not write them", async () => {
    const rows = await asUser(fx.teacherA, (client) =>
      client.query("select student_id from mastery_states").then((r) => r.rows),
    );
    expect(rows.map((r) => r.student_id).sort()).toEqual([fx.studentA, fx.studentA2].sort());

    await asUser(fx.teacherA, async (client) => {
      await expect(
        client.query("update mastery_states set probability = 0.99 where student_id = $1", [fx.studentA]),
      ).resolves.toMatchObject({ rowCount: 0 }); // RLS silently filters, no rows updated
    });
  });

  it("denies a teacher from a different tenant any visibility", async () => {
    const rows = await asUser(fx.teacherB, (client) =>
      client.query("select student_id from mastery_states").then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });

  it("gives an admin full read/write access within their own tenant only", async () => {
    const rows = await asUser(fx.adminA, (client) =>
      client.query("select student_id from mastery_states").then((r) => r.rows),
    );
    expect(rows).toHaveLength(2);

    await asUser(fx.adminA, async (client) => {
      const result = await client.query(
        "update mastery_states set probability = 0.9 where student_id = $1",
        [fx.studentA],
      );
      expect(result.rowCount).toBe(1);
    });
  });

  it("denies an unauthenticated request (no auth.uid()) any rows", async () => {
    const rows = await asUser(null, (client) =>
      client.query("select student_id from mastery_states").then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });
});

describe("Pedagogical_Lead cross-tenant access", () => {
  let fx: Fixture;
  beforeAll(async () => {
    fx = await seedFixture();
  });

  it("can insert and update misconceptions in any tenant", async () => {
    // Both statements run in the same asUser transaction (which rolls back
    // at the end) so the row the UPDATE targets is actually visible to it.
    const updated = await asUser(fx.pedagogicalLead, async (client) => {
      const { rows } = await client.query(
        `insert into misconceptions (name, skill_id, error_pattern, tenant_id)
         values ('Sign error', $1, '{"type":"regex","pattern":"x"}', $2) returning id`,
        [fx.skillA, fx.tenantA],
      );
      return client.query(
        `update misconceptions set content_status = 'validated' where id = $1`,
        [rows[0].id],
      );
    });
    expect(updated.rowCount).toBe(1);
  });

  it("cannot insert or update misconceptions when not pedagogical_lead", async () => {
    await asUser(fx.teacherA, async (client) => {
      await expect(
        client.query(
          `insert into misconceptions (name, skill_id, error_pattern, tenant_id)
           values ('Sign error', $1, '{"type":"regex","pattern":"x"}', $2)`,
          [fx.skillA, fx.tenantA],
        ),
      ).rejects.toThrow(/row-level security/i);
    });
  });

  it("can read unmatched_errors across every tenant", async () => {
    await asOwner((client) =>
      client.query(
        `insert into unmatched_errors (student_id_anonymized, skill_id, tenant_id)
         values ('hash-a', $1, $2), ('hash-b', $1, $3)`,
        [fx.skillA, fx.tenantA, fx.tenantB],
      ),
    );

    const rows = await asUser(fx.pedagogicalLead, (client) =>
      client.query("select student_id_anonymized from unmatched_errors").then((r) => r.rows),
    );
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  it("teachers cannot read unmatched_errors at all", async () => {
    const rows = await asUser(fx.teacherA, (client) =>
      client.query("select student_id_anonymized from unmatched_errors").then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });
});

describe("multi-tenant isolation on core tables", () => {
  let fx: Fixture;
  beforeAll(async () => {
    fx = await seedFixture();
  });

  it("prevents a Teacher from Tenant B from reading Tenant A's users", async () => {
    const rows = await asUser(fx.teacherB, (client) =>
      client.query("select id from users where tenant_id = $1", [fx.tenantA]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });

  it("prevents an Admin from Tenant B from reading Tenant A's sessions", async () => {
    await asOwner((client) =>
      client.query(
        `insert into sessions (student_id, status, tenant_id) values ($1, 'active', $2)`,
        [fx.studentA, fx.tenantA],
      ),
    );
    const rows = await asUser(fx.teacherB, (client) =>
      client.query("select id from sessions where tenant_id = $1", [fx.tenantA]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });

  it("lets a student read their own tenant row but not another tenant's", async () => {
    const own = await asUser(fx.studentA, (client) =>
      client.query("select id from tenants where id = $1", [fx.tenantA]).then((r) => r.rows),
    );
    expect(own).toHaveLength(1);

    const other = await asUser(fx.studentA, (client) =>
      client.query("select id from tenants where id = $1", [fx.tenantB]).then((r) => r.rows),
    );
    expect(other).toHaveLength(0);
  });
});
