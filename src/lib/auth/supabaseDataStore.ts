import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type {
  AuthDataStore,
  EscolentUser,
  LmsConfig,
  Role,
  UpsertUserInput,
} from "./dataStore";

/**
 * Production AuthDataStore, backed by Supabase. Every method here runs
 * pre-session (there's no auth.uid() yet for an LTI/Google launch that
 * hasn't resolved to a user), so it always uses the service-role client —
 * bypassing RLS is correct and necessary here, not a shortcut. Once a
 * session is actually established, all subsequent requests go through the
 * normal RLS-scoped server/browser clients (src/lib/supabase/server.ts,
 * client.ts), not this one.
 */
export class SupabaseAuthDataStore implements AuthDataStore {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient = createServiceRoleClient()) {
    this.client = client;
  }

  async findLmsConfigByIssuerAndDeployment(
    issuer: string,
    deploymentId: string,
  ): Promise<LmsConfig | null> {
    const { data, error } = await this.client
      .from("lms_configs")
      .select("tenant_id, lms_type, issuer, client_id, deployment_id, jwks_url, auth_login_url")
      .eq("issuer", issuer)
      .eq("deployment_id", deploymentId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      tenantId: data.tenant_id,
      lmsType: data.lms_type,
      issuer: data.issuer,
      clientId: data.client_id,
      deploymentId: data.deployment_id,
      jwksUrl: data.jwks_url,
      authLoginUrl: data.auth_login_url,
    };
  }

  async findTenantIdByGoogleWorkspaceDomain(domain: string): Promise<string | null> {
    const { data, error } = await this.client
      .from("google_workspace_domains")
      .select("tenant_id")
      .eq("domain", domain)
      .maybeSingle();

    if (error) throw error;
    return data?.tenant_id ?? null;
  }

  async upsertUser(input: UpsertUserInput): Promise<EscolentUser> {
    const existing = await this.findUserByEmail(input.email);
    if (existing) return existing;

    const { data, error } = await this.client
      .from("users")
      .insert({
        id: input.id,
        tenant_id: input.tenantId,
        email: input.email,
        full_name: input.fullName ?? null,
        lms_user_id: input.lmsUserId ?? null,
        google_classroom_id: input.googleClassroomId ?? null,
      })
      .select("id, tenant_id, email")
      .single();

    if (error) throw error;
    return { id: data.id, tenantId: data.tenant_id, email: data.email };
  }

  async assignRole(userId: string, role: Role, tenantId: string | null): Promise<void> {
    const { error } = await this.client
      .from("user_roles")
      .upsert(
        { user_id: userId, role, tenant_id: tenantId },
        { onConflict: "user_id,role", ignoreDuplicates: true },
      );
    if (error) throw error;
  }

  async hasRole(userId: string, role: Role): Promise<boolean> {
    const { data, error } = await this.client
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", role)
      .maybeSingle();
    if (error) throw error;
    return data !== null;
  }

  async findUserByEmail(email: string): Promise<EscolentUser | null> {
    const { data, error } = await this.client
      .from("users")
      .select("id, tenant_id, email")
      .eq("email", email)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { id: data.id, tenantId: data.tenant_id, email: data.email };
  }
}
