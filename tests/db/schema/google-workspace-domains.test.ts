/**
 * Task 3.3: Google Classroom API authentication flow — tenant resolution.
 * Requirements: 1.3, 1.4, 1.5
 *
 * A Google Classroom launch's ID token carries an `hd` (hosted domain)
 * claim for Google Workspace accounts (e.g. "teneo.school") — this table
 * maps that domain to a tenant, the Google-side analogue of lms_configs'
 * (issuer, deployment_id) mapping for LTI.
 */
import { asOwner, closeTestDb } from "../helpers/testDb";
import {
  foreignKeyTargets,
  getColumn,
  indexExists,
  rlsEnabled,
  tableExists,
} from "../helpers/introspect";

afterAll(closeTestDb);

describe("google_workspace_domains table", () => {
  it("exists with a unique domain column", async () => {
    await asOwner(async (client) => {
      expect(await tableExists(client, "google_workspace_domains")).toBe(true);

      const domain = await getColumn(client, "google_workspace_domains", "domain");
      expect(domain?.is_nullable).toBe("NO");

      await client.query("begin");
      try {
        const { rows: tenantRows } = await client.query(
          `insert into tenants (name, slug) values ('T', 'gwd-test') returning id`,
        );
        const tenantId = tenantRows[0].id;
        await client.query(
          `insert into google_workspace_domains (tenant_id, domain) values ($1, 'teneo.school')`,
          [tenantId],
        );
        await expect(
          client.query(
            `insert into google_workspace_domains (tenant_id, domain) values ($1, 'teneo.school')`,
            [tenantId],
          ),
        ).rejects.toThrow(/unique/i);
      } finally {
        await client.query("rollback");
      }
    });
  });

  it("cascades on tenant deletion", async () => {
    await asOwner(async (client) => {
      const fk = await foreignKeyTargets(client, "google_workspace_domains", "tenant_id");
      expect(fk).toEqual({ targetTable: "tenants", onDelete: "CASCADE" });
    });
  });

  it("has an index for tenant-scoped lookups", async () => {
    await asOwner(async (client) => {
      expect(await indexExists(client, "idx_google_workspace_domains_tenant")).toBe(true);
    });
  });

  it("has row level security enabled", async () => {
    await asOwner(async (client) => {
      expect(await rlsEnabled(client, "google_workspace_domains")).toBe(true);
    });
  });
});
