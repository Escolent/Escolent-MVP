/**
 * Task 1.4: Create misconception taxonomy and spaced repetition database
 * tables.
 * Requirements: 4.1, 4.2, 4.7, 4.8, 5.1
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

describe("misconceptions table", () => {
  it("exists with error_pattern JSONB and classification enum", async () => {
    await asOwner(async (client) => {
      expect(await tableExists(client, "misconceptions")).toBe(true);

      const errorPattern = await getColumn(client, "misconceptions", "error_pattern");
      expect(errorPattern?.data_type).toBe("jsonb");
      expect(errorPattern?.is_nullable).toBe("NO");

      const classification = await getColumn(client, "misconceptions", "classification");
      expect(classification).toBeDefined();

      const contentStatus = await getColumn(client, "misconceptions", "content_status");
      expect(contentStatus?.column_default).toMatch(/draft/);
    });
  });

  it("restricts classification and content_status to their documented sets", async () => {
    await asOwner(async (client) => {
      const defs = await checkConstraintDefs(client, "misconceptions");
      for (const value of [
        "repetition_confirmed",
        "first_occurrence_actionable",
        "draft",
        "pending_approval",
        "validated",
      ]) {
        expect(defs).toMatch(new RegExp(value));
      }
    });
  });

  it("cascades on skill deletion and allows a null tenant_id (platform-level)", async () => {
    await asOwner(async (client) => {
      const fk = await foreignKeyTargets(client, "misconceptions", "skill_id");
      expect(fk).toEqual({ targetTable: "skills", onDelete: "CASCADE" });

      const tenantId = await getColumn(client, "misconceptions", "tenant_id");
      expect(tenantId?.is_nullable).toBe("YES");
    });
  });

  it("has row level security enabled", async () => {
    await asOwner(async (client) => {
      expect(await rlsEnabled(client, "misconceptions")).toBe(true);
    });
  });
});

describe("student_misconceptions table", () => {
  it("tracks occurrence counts per student per misconception", async () => {
    await asOwner(async (client) => {
      expect(await tableExists(client, "student_misconceptions")).toBe(true);

      const occurrenceCount = await getColumn(client, "student_misconceptions", "occurrence_count");
      expect(occurrenceCount?.column_default).toBe("1");

      const studentFk = await foreignKeyTargets(client, "student_misconceptions", "student_id");
      expect(studentFk).toEqual({ targetTable: "users", onDelete: "CASCADE" });

      const misconceptionFk = await foreignKeyTargets(
        client,
        "student_misconceptions",
        "misconception_id",
      );
      expect(misconceptionFk).toEqual({ targetTable: "misconceptions", onDelete: "CASCADE" });
    });
  });

  it("has row level security enabled", async () => {
    await asOwner(async (client) => {
      expect(await rlsEnabled(client, "student_misconceptions")).toBe(true);
    });
  });
});

describe("unmatched_errors table", () => {
  it("stores an anonymized student ID rather than a direct FK to users", async () => {
    await asOwner(async (client) => {
      expect(await tableExists(client, "unmatched_errors")).toBe(true);

      const anonId = await getColumn(client, "unmatched_errors", "student_id_anonymized");
      expect(anonId?.is_nullable).toBe("NO");

      const reviewed = await getColumn(client, "unmatched_errors", "reviewed");
      expect(reviewed?.column_default).toMatch(/false/);

      const reviewedBy = await foreignKeyTargets(client, "unmatched_errors", "reviewed_by");
      expect(reviewedBy?.targetTable).toBe("users");
    });
  });

  it("has row level security enabled", async () => {
    await asOwner(async (client) => {
      expect(await rlsEnabled(client, "unmatched_errors")).toBe(true);
    });
  });
});

describe("spaced_repetition_schedules table", () => {
  it("has a composite primary key of (student_id, skill_id)", async () => {
    await asOwner(async (client) => {
      expect(await tableExists(client, "spaced_repetition_schedules")).toBe(true);
      expect(
        (await primaryKeyColumns(client, "spaced_repetition_schedules")).sort(),
      ).toEqual(["skill_id", "student_id"]);
    });
  });

  it("constrains ease_factor to the SM-2 range [1.3, 2.5]", async () => {
    await asOwner(async (client) => {
      const defs = await checkConstraintDefs(client, "spaced_repetition_schedules");
      expect(defs).toMatch(/ease_factor/);
      expect(defs).toMatch(/1\.3/);
      expect(defs).toMatch(/2\.5/);
    });
  });

  it("has an index supporting due-review queries", async () => {
    await asOwner(async (client) => {
      expect(await indexExists(client, "idx_spaced_rep_due")).toBe(true);
    });
  });

  it("has row level security enabled", async () => {
    await asOwner(async (client) => {
      expect(await rlsEnabled(client, "spaced_repetition_schedules")).toBe(true);
    });
  });
});
