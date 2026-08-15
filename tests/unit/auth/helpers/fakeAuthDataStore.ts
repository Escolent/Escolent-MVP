import type {
  AuthDataStore,
  EscolentUser,
  LmsConfig,
  Role,
  UpsertUserInput,
} from "@/lib/auth/dataStore";

/**
 * In-memory AuthDataStore for fast unit tests (task 3.2) that don't need a
 * real database — they're exercising JWT verification and claims-mapping
 * logic, not persistence. tests/db/auth/** (task 3.6) exercises the exact
 * same session.ts/establishLtiSession against a real local Postgres via
 * PgAuthDataStore instead, so the persistence path itself is still
 * genuinely tested, just not by these particular tests.
 */
export class FakeAuthDataStore implements AuthDataStore {
  private lmsConfigs: LmsConfig[] = [];
  private googleDomains = new Map<string, string>();
  private users: EscolentUser[] = [];
  private roles = new Set<string>(); // `${userId}:${role}:${tenantId}`

  seedLmsConfig(config: LmsConfig): void {
    this.lmsConfigs.push(config);
  }

  seedGoogleWorkspaceDomain(domain: string, tenantId: string): void {
    this.googleDomains.set(domain, tenantId);
  }

  async findLmsConfigByIssuerAndDeployment(
    issuer: string,
    deploymentId: string,
  ): Promise<LmsConfig | null> {
    return (
      this.lmsConfigs.find((c) => c.issuer === issuer && c.deploymentId === deploymentId) ?? null
    );
  }

  async findTenantIdByGoogleWorkspaceDomain(domain: string): Promise<string | null> {
    return this.googleDomains.get(domain) ?? null;
  }

  async upsertUser(input: UpsertUserInput): Promise<EscolentUser> {
    const existing = this.users.find((u) => u.email === input.email);
    if (existing) return existing;
    const user: EscolentUser = { id: input.id, tenantId: input.tenantId, email: input.email };
    this.users.push(user);
    return user;
  }

  async assignRole(userId: string, role: Role, tenantId: string | null): Promise<void> {
    this.roles.add(`${userId}:${role}:${tenantId ?? "null"}`);
  }

  async hasRole(userId: string, role: Role): Promise<boolean> {
    return Array.from(this.roles).some((r) => r.startsWith(`${userId}:${role}:`));
  }

  async findUserByEmail(email: string): Promise<EscolentUser | null> {
    return this.users.find((u) => u.email === email) ?? null;
  }
}
