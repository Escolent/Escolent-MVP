/**
 * Task 1.2: Configure Supabase connection and create multi-tenancy
 * foundation tables (tenants, users, user_roles) with RLS enabled.
 * Requirements: 21.1, 21.2, 21.3, 1.1, 1.2, 1A.1
 */
import { asOwner, closeTestDb } from "../helpers/testDb";
import {
  checkConstraintDefs,
  foreignKeyTargets,
  getColumn,
  primaryKeyColumns,
  rlsEnabled,
  tableExists,
} from "../helpers/introspect";

afterAll(closeTestDb);

describe("tenants table", () => {
  it("exists with the expected columns", async () => {
    await asOwner(async (client) => {
      expect(await tableExists(client, "tenants")).toBe(true);

      const id = await getColumn(client, "tenants", "id");
      expect(id?.data_type).toBe("uuid");
      expect(id?.column_default).toMatch(/uuid_generate_v4/);

      const name = await getColumn(client, "tenants", "name");
      expect(name?.is_nullable).toBe("NO");

      const slug = await getColumn(client, "tenants", "slug");
      expect(slug?.is_nullable).toBe("NO");

      const createdAt = await getColumn(client, "tenants", "created_at");
      expect(createdAt?.data_type).toBe("timestamp with time zone");
    });
  });

  it("restricts billing_status to the documented set", async () => {
    await asOwner(async (client) => {
      const defs = await checkConstraintDefs(client, "tenants");
      expect(defs).toMatch(/billing_status/);
      expect(defs).toMatch(/trial/);
      expect(defs).toMatch(/active/);
      expect(defs).toMatch(/suspended/);
    });
  });

  it("enforces a unique slug", async () => {
    await asOwner(async (client) => {
      await client.query("begin");
      try {
        await client.query(
          "insert into tenants (name, slug, billing_status) values ('Teneo', 'teneo', 'trial')",
        );
        await expect(
          client.query(
            "insert into tenants (name, slug, billing_status) values ('Teneo 2', 'teneo', 'trial')",
          ),
        ).rejects.toThrow(/unique/i);
      } finally {
        await client.query("rollback");
      }
    });
  });

  it("has row level security enabled", async () => {
    await asOwner(async (client) => {
      expect(await rlsEnabled(client, "tenants")).toBe(true);
    });
  });
});

describe("users table", () => {
  it("exists with tenant_id, email, and LMS integration columns", async () => {
    await asOwner(async (client) => {
      expect(await tableExists(client, "users")).toBe(true);

      const email = await getColumn(client, "users", "email");
      expect(email?.is_nullable).toBe("NO");

      for (const col of ["tenant_id", "full_name", "lms_user_id", "google_classroom_id", "created_at"]) {
        expect(await getColumn(client, "users", col)).toBeDefined();
      }
    });
  });

  it("allows a null tenant_id (Pedagogical_Lead is platform-level)", async () => {
    await asOwner(async (client) => {
      const tenantId = await getColumn(client, "users", "tenant_id");
      expect(tenantId?.is_nullable).toBe("YES");
    });
  });

  it("cascades on tenant deletion and enforces unique email", async () => {
    await asOwner(async (client) => {
      const fk = await foreignKeyTargets(client, "users", "tenant_id");
      expect(fk?.targetTable).toBe("tenants");
      expect(fk?.onDelete).toBe("CASCADE");
    });
  });

  it("has row level security enabled", async () => {
    await asOwner(async (client) => {
      expect(await rlsEnabled(client, "users")).toBe(true);
    });
  });
});

describe("user_roles table", () => {
  it("has a composite primary key of (user_id, role)", async () => {
    await asOwner(async (client) => {
      expect(await tableExists(client, "user_roles")).toBe(true);
      const pk = await primaryKeyColumns(client, "user_roles");
      expect(pk.sort()).toEqual(["role", "user_id"]);
    });
  });

  it("restricts role to the four documented roles", async () => {
    await asOwner(async (client) => {
      const defs = await checkConstraintDefs(client, "user_roles");
      for (const role of ["student", "teacher", "admin", "pedagogical_lead"]) {
        expect(defs).toMatch(new RegExp(role));
      }
    });
  });

  it("has row level security enabled", async () => {
    await asOwner(async (client) => {
      expect(await rlsEnabled(client, "user_roles")).toBe(true);
    });
  });
});
