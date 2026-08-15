/**
 * Task 3.1: Store LMS configuration per tenant in `lms_configs` table.
 * Requirements: 1.1, 1.2, 1.4, 1.5, 1.6
 */
import { asOwner, closeTestDb } from "../helpers/testDb";
import {
  checkConstraintDefs,
  foreignKeyTargets,
  getColumn,
  indexExists,
  rlsEnabled,
  tableExists,
} from "../helpers/introspect";

afterAll(closeTestDb);

describe("lms_configs table", () => {
  it("exists with the columns an LTI 1.3 launch needs to verify itself", async () => {
    await asOwner(async (client) => {
      expect(await tableExists(client, "lms_configs")).toBe(true);

      for (const col of [
        "tenant_id",
        "lms_type",
        "issuer",
        "client_id",
        "deployment_id",
        "auth_login_url",
        "jwks_url",
      ]) {
        const column = await getColumn(client, "lms_configs", col);
        expect(column).toBeDefined();
        expect(column?.is_nullable).toBe("NO");
      }

      // Optional: only needed for LTI Advantage service calls, not launch verification.
      const authTokenUrl = await getColumn(client, "lms_configs", "auth_token_url");
      expect(authTokenUrl).toBeDefined();
    });
  });

  it("restricts lms_type to canvas/moodle", async () => {
    await asOwner(async (client) => {
      const defs = await checkConstraintDefs(client, "lms_configs");
      expect(defs).toMatch(/canvas/);
      expect(defs).toMatch(/moodle/);
    });
  });

  it("cascades on tenant deletion", async () => {
    await asOwner(async (client) => {
      const fk = await foreignKeyTargets(client, "lms_configs", "tenant_id");
      expect(fk).toEqual({ targetTable: "tenants", onDelete: "CASCADE" });
    });
  });

  it("enforces one config per (issuer, deployment_id) — the pair an LTI launch is looked up by", async () => {
    await asOwner(async (client) => {
      await client.query("begin");
      try {
        const { rows: tenantRows } = await client.query(
          `insert into tenants (name, slug) values ('T', 'lms-config-test') returning id`,
        );
        const tenantId = tenantRows[0].id;

        await client.query(
          `insert into lms_configs (tenant_id, lms_type, issuer, client_id, deployment_id, auth_login_url, jwks_url)
           values ($1, 'canvas', 'https://canvas.example.com', 'client-1', 'deploy-1', 'https://canvas.example.com/login', 'https://canvas.example.com/jwks')`,
          [tenantId],
        );

        await expect(
          client.query(
            `insert into lms_configs (tenant_id, lms_type, issuer, client_id, deployment_id, auth_login_url, jwks_url)
             values ($1, 'canvas', 'https://canvas.example.com', 'client-2', 'deploy-1', 'https://canvas.example.com/login', 'https://canvas.example.com/jwks')`,
            [tenantId],
          ),
        ).rejects.toThrow(/unique/i);
      } finally {
        await client.query("rollback");
      }
    });
  });

  it("has an index for tenant-scoped lookups", async () => {
    await asOwner(async (client) => {
      expect(await indexExists(client, "idx_lms_configs_tenant")).toBe(true);
    });
  });

  it("has row level security enabled", async () => {
    await asOwner(async (client) => {
      expect(await rlsEnabled(client, "lms_configs")).toBe(true);
    });
  });
});
