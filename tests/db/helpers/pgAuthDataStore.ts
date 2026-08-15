import type { PoolClient } from "pg";
import type {
  AuthDataStore,
  EscolentUser,
  LmsConfig,
  Role,
  UpsertUserInput,
} from "@/lib/auth/dataStore";

/**
 * Test-only AuthDataStore, backed by a real Postgres connection (via the
 * owner/service-role-equivalent client — same reasoning as
 * SupabaseAuthDataStore's use of the service-role client: these lookups
 * happen pre-session). Lets tests/db/auth/** (task 3.6) exercise
 * establishLtiSession et al. against the actual schema instead of a
 * hand-rolled mock, the same way tests/db/rls/** exercises real RLS
 * instead of asserting policies exist and calling it done.
 */
export class PgAuthDataStore implements AuthDataStore {
  constructor(private readonly client: PoolClient) {}

  async findLmsConfigByIssuerAndDeployment(
    issuer: string,
    deploymentId: string,
  ): Promise<LmsConfig | null> {
    const { rows } = await this.client.query(
      `select tenant_id, lms_type, issuer, client_id, deployment_id, jwks_url, auth_login_url
       from lms_configs where issuer = $1 and deployment_id = $2`,
      [issuer, deploymentId],
    );
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      tenantId: row.tenant_id,
      lmsType: row.lms_type,
      issuer: row.issuer,
      clientId: row.client_id,
      deploymentId: row.deployment_id,
      jwksUrl: row.jwks_url,
      authLoginUrl: row.auth_login_url,
    };
  }

  async findTenantIdByGoogleWorkspaceDomain(domain: string): Promise<string | null> {
    const { rows } = await this.client.query(
      `select tenant_id from google_workspace_domains where domain = $1`,
      [domain],
    );
    return rows[0]?.tenant_id ?? null;
  }

  async upsertUser(input: UpsertUserInput): Promise<EscolentUser> {
    const existing = await this.findUserByEmail(input.email);
    if (existing) return existing;

    const { rows } = await this.client.query(
      `insert into users (id, tenant_id, email, full_name, lms_user_id, google_classroom_id)
       values ($1, $2, $3, $4, $5, $6)
       returning id, tenant_id, email`,
      [
        input.id,
        input.tenantId,
        input.email,
        input.fullName ?? null,
        input.lmsUserId ?? null,
        input.googleClassroomId ?? null,
      ],
    );
    const row = rows[0];
    return { id: row.id, tenantId: row.tenant_id, email: row.email };
  }

  async assignRole(userId: string, role: Role, tenantId: string | null): Promise<void> {
    await this.client.query(
      `insert into user_roles (user_id, role, tenant_id) values ($1, $2, $3)
       on conflict (user_id, role) do nothing`,
      [userId, role, tenantId],
    );
  }

  async hasRole(userId: string, role: Role): Promise<boolean> {
    const { rows } = await this.client.query(
      `select 1 from user_roles where user_id = $1 and role = $2`,
      [userId, role],
    );
    return rows.length > 0;
  }

  async findUserByEmail(email: string): Promise<EscolentUser | null> {
    const { rows } = await this.client.query(
      `select id, tenant_id, email from users where email = $1`,
      [email],
    );
    if (rows.length === 0) return null;
    const row = rows[0];
    return { id: row.id, tenantId: row.tenant_id, email: row.email };
  }
}
