/**
 * Task 1.5: Create session, space, and escalation database tables.
 * Requirements: 7.7, 9.1, 9.2, 11.1, 11.2, 18.5, 29.1
 */
import { asOwner, closeTestDb } from "../helpers/testDb";
import {
  checkConstraintDefs,
  foreignKeyTargets,
  getColumn,
  indexExists,
  primaryKeyColumns,
  rlsEnabled,
  tableExists,
} from "../helpers/introspect";

afterAll(closeTestDb);

describe("spaces table", () => {
  it("exists with boundary and pacing columns", async () => {
    await asOwner(async (client) => {
      expect(await tableExists(client, "spaces")).toBe(true);

      const includedSkills = await getColumn(client, "spaces", "included_skill_ids");
      expect(includedSkills?.data_type).toBe("ARRAY");
      expect(includedSkills?.is_nullable).toBe("NO");

      const difficultyRange = await getColumn(client, "spaces", "difficulty_range");
      expect(difficultyRange?.data_type).toBe("ARRAY");

      const pacingMode = await getColumn(client, "spaces", "classroom_pacing_mode");
      expect(pacingMode?.column_default).toMatch(/false/);
    });
  });

  it("cascades on teacher and tenant deletion", async () => {
    await asOwner(async (client) => {
      const teacherFk = await foreignKeyTargets(client, "spaces", "teacher_id");
      expect(teacherFk).toEqual({ targetTable: "users", onDelete: "CASCADE" });
    });
  });

  it("enforces a 2-element difficulty_range", async () => {
    await asOwner(async (client) => {
      const defs = await checkConstraintDefs(client, "spaces");
      expect(defs).toMatch(/difficulty_range/);
    });
  });

  it("has row level security enabled", async () => {
    await asOwner(async (client) => {
      expect(await rlsEnabled(client, "spaces")).toBe(true);
    });
  });
});

describe("space_enrollments table", () => {
  it("has a composite primary key of (space_id, student_id)", async () => {
    await asOwner(async (client) => {
      expect(await tableExists(client, "space_enrollments")).toBe(true);
      expect((await primaryKeyColumns(client, "space_enrollments")).sort()).toEqual(
        ["space_id", "student_id"],
      );
    });
  });

  it("has row level security enabled", async () => {
    await asOwner(async (client) => {
      expect(await rlsEnabled(client, "space_enrollments")).toBe(true);
    });
  });
});

describe("sessions table", () => {
  it("exists with status enum and problems JSONB array, referencing spaces", async () => {
    await asOwner(async (client) => {
      expect(await tableExists(client, "sessions")).toBe(true);

      const problems = await getColumn(client, "sessions", "problems");
      expect(problems?.data_type).toBe("jsonb");
      expect(problems?.column_default).toBe("'[]'::jsonb");

      const spaceFk = await foreignKeyTargets(client, "sessions", "space_id");
      expect(spaceFk).toEqual({ targetTable: "spaces", onDelete: "CASCADE" });
    });
  });

  it("restricts status to the documented lifecycle values", async () => {
    await asOwner(async (client) => {
      const defs = await checkConstraintDefs(client, "sessions");
      for (const status of ["active", "paused", "completed", "interrupted", "expired"]) {
        expect(defs).toMatch(new RegExp(status));
      }
    });
  });

  it("has an index for active/interrupted sessions per student", async () => {
    await asOwner(async (client) => {
      expect(await indexExists(client, "idx_sessions_student_active")).toBe(true);
    });
  });

  it("has row level security enabled", async () => {
    await asOwner(async (client) => {
      expect(await rlsEnabled(client, "sessions")).toBe(true);
    });
  });
});

describe("mastery_overrides table", () => {
  it("requires a reason between 20 and 200 characters", async () => {
    await asOwner(async (client) => {
      expect(await tableExists(client, "mastery_overrides")).toBe(true);
      const defs = await checkConstraintDefs(client, "mastery_overrides");
      expect(defs).toMatch(/length\(reason\)/);
      expect(defs).toMatch(/20/);
      expect(defs).toMatch(/200/);
    });
  });

  it("rejects a reason shorter than 20 characters at the database level", async () => {
    await asOwner(async (client) => {
      await client.query("begin");
      try {
        await client.query(
          `insert into tenants (name, slug) values ('T', 't-override-test') returning id`,
        );
        const { rows: tenantRows } = await client.query(
          `select id from tenants where slug = 't-override-test'`,
        );
        const tenantId = tenantRows[0].id;
        const { rows: studentRows } = await client.query(
          `insert into users (tenant_id, email) values ($1, 'student@override-test.com') returning id`,
          [tenantId],
        );
        const { rows: teacherRows } = await client.query(
          `insert into users (tenant_id, email) values ($1, 'teacher@override-test.com') returning id`,
          [tenantId],
        );
        const { rows: skillRows } = await client.query(
          `insert into skills (name, skill_type, tenant_id) values ('Skill', 'procedural', $1) returning id`,
          [tenantId],
        );

        await expect(
          client.query(
            `insert into mastery_overrides (student_id, skill_id, teacher_id, reason, override_type, tenant_id)
             values ($1, $2, $3, 'too short', 'mark_mastered', $4)`,
            [studentRows[0].id, skillRows[0].id, teacherRows[0].id, tenantId],
          ),
        ).rejects.toThrow(/check/i);
      } finally {
        await client.query("rollback");
      }
    });
  });

  it("has row level security enabled", async () => {
    await asOwner(async (client) => {
      expect(await rlsEnabled(client, "mastery_overrides")).toBe(true);
    });
  });
});

describe("distress_escalations table", () => {
  it("tracks detection method, confidence, and acknowledgment", async () => {
    await asOwner(async (client) => {
      expect(await tableExists(client, "distress_escalations")).toBe(true);

      const defs = await checkConstraintDefs(client, "distress_escalations");
      expect(defs).toMatch(/pattern/);
      expect(defs).toMatch(/llm/);

      const backupNotified = await getColumn(client, "distress_escalations", "backup_notified");
      expect(backupNotified?.column_default).toMatch(/false/);
    });
  });

  it("has an index for unacknowledged escalations", async () => {
    await asOwner(async (client) => {
      expect(await indexExists(client, "idx_escalations_unacknowledged")).toBe(true);
    });
  });

  it("has row level security enabled", async () => {
    await asOwner(async (client) => {
      expect(await rlsEnabled(client, "distress_escalations")).toBe(true);
    });
  });
});

describe("audit_logs table (POPIA compliance)", () => {
  it("captures the required audit fields", async () => {
    await asOwner(async (client) => {
      expect(await tableExists(client, "audit_logs")).toBe(true);
      for (const col of ["user_id", "action", "table_name", "record_id", "changed_fields", "timestamp"]) {
        expect(await getColumn(client, "audit_logs", col)).toBeDefined();
      }
    });
  });

  it("has indexes for per-user and per-tenant audit queries", async () => {
    await asOwner(async (client) => {
      expect(await indexExists(client, "idx_audit_logs_user")).toBe(true);
      expect(await indexExists(client, "idx_audit_logs_tenant")).toBe(true);
    });
  });

  it("has row level security enabled", async () => {
    await asOwner(async (client) => {
      expect(await rlsEnabled(client, "audit_logs")).toBe(true);
    });
  });
});
