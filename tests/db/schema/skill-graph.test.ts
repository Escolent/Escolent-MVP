/**
 * Task 1.3: Create skill graph and mastery state database tables.
 * Requirements: 2.1, 2.2, 2.5, 3.2, 3.3, 31.1, 31.6
 *
 * `subject` (Requirement 31.1/31.6, design.md's Skill TS interface) was
 * added after Task 1.3 originally merged, once tasks.md/design.md were
 * revised to make the Platform explicitly subject-agnostic — see
 * supabase/migrations/20250101000007_add_skill_subject.sql.
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

describe("skills table", () => {
  it("exists with the expected columns and defaults", async () => {
    await asOwner(async (client) => {
      expect(await tableExists(client, "skills")).toBe(true);

      const skillType = await getColumn(client, "skills", "skill_type");
      expect(skillType).toBeDefined();

      // Used to parameterize LLM tutor prompts (design.md Section 13) and
      // dashboard grouping, e.g. "Grade 8 Mathematics". Nullable: platform
      // rows in flight through content authoring may not have it set yet,
      // and tasks.md doesn't call for a NOT NULL constraint.
      const subject = await getColumn(client, "skills", "subject");
      expect(subject?.data_type).toBe("text");
      expect(subject?.is_nullable).toBe("YES");

      const prereqIds = await getColumn(client, "skills", "prerequisite_ids");
      expect(prereqIds?.data_type).toBe("ARRAY");

      const tenantId = await getColumn(client, "skills", "tenant_id");
      expect(tenantId?.is_nullable).toBe("YES"); // NULL = platform-level

      const evalStrategy = await getColumn(client, "skills", "evaluation_strategy");
      expect(evalStrategy?.column_default).toMatch(/exact_match/);

      const contentStatus = await getColumn(client, "skills", "content_status");
      expect(contentStatus?.column_default).toMatch(/draft/);

      const coverageStatus = await getColumn(client, "skills", "coverage_status");
      expect(coverageStatus?.column_default).toMatch(/not_assessed/);

      const rubric = await getColumn(client, "skills", "rubric");
      expect(rubric?.data_type).toBe("jsonb");
    });
  });

  it("restricts skill_type, evaluation_strategy, content_status, and coverage_status to their documented sets", async () => {
    await asOwner(async (client) => {
      const defs = await checkConstraintDefs(client, "skills");
      for (const value of [
        "procedural",
        "conceptual",
        "exact_match",
        "symbolic_equivalence",
        "rubric_llm",
        "draft",
        "pending_approval",
        "validated",
        "rich",
        "thin",
        "gap",
        "not_assessed",
      ]) {
        expect(defs).toMatch(new RegExp(value));
      }
    });
  });

  it("has indexes for tenant lookup and prerequisite traversal", async () => {
    await asOwner(async (client) => {
      expect(await indexExists(client, "idx_skills_tenant")).toBe(true);
      expect(await indexExists(client, "idx_skills_prerequisites")).toBe(true);
    });
  });

  it("has row level security enabled", async () => {
    await asOwner(async (client) => {
      expect(await rlsEnabled(client, "skills")).toBe(true);
    });
  });
});

describe("mastery_states table", () => {
  it("has a composite primary key of (student_id, skill_id)", async () => {
    await asOwner(async (client) => {
      expect(await tableExists(client, "mastery_states")).toBe(true);
      expect((await primaryKeyColumns(client, "mastery_states")).sort()).toEqual(
        ["skill_id", "student_id"],
      );
    });
  });

  it("constrains probability to [0, 1] and tracks mastery flags/history", async () => {
    await asOwner(async (client) => {
      const probability = await getColumn(client, "mastery_states", "probability");
      expect(probability?.data_type).toBe("numeric");

      const defs = await checkConstraintDefs(client, "mastery_states");
      expect(defs).toMatch(/probability/);

      const history = await getColumn(client, "mastery_states", "response_history");
      expect(history?.data_type).toBe("jsonb");
      expect(history?.column_default).toBe("'[]'::jsonb");

      const tentative = await getColumn(client, "mastery_states", "is_tentatively_mastered");
      expect(tentative?.column_default).toMatch(/false/);

      const durable = await getColumn(client, "mastery_states", "is_durably_mastered");
      expect(durable?.column_default).toMatch(/false/);

      const sessionCount = await getColumn(client, "mastery_states", "mastered_session_count");
      expect(sessionCount?.column_default).toBe("0");
    });
  });

  it("cascades on student and skill deletion", async () => {
    await asOwner(async (client) => {
      const studentFk = await foreignKeyTargets(client, "mastery_states", "student_id");
      expect(studentFk).toEqual({ targetTable: "users", onDelete: "CASCADE" });

      const skillFk = await foreignKeyTargets(client, "mastery_states", "skill_id");
      expect(skillFk).toEqual({ targetTable: "skills", onDelete: "CASCADE" });
    });
  });

  it("has indexes for per-student and per-skill lookups", async () => {
    await asOwner(async (client) => {
      expect(await indexExists(client, "idx_mastery_student")).toBe(true);
      expect(await indexExists(client, "idx_mastery_skill")).toBe(true);
    });
  });

  it("has row level security enabled", async () => {
    await asOwner(async (client) => {
      expect(await rlsEnabled(client, "mastery_states")).toBe(true);
    });
  });
});
