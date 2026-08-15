import { AUTH_ERROR_CODES, AuthError } from "@/lib/api/errors";
import type { AuthDataStore } from "../dataStore";
import type { PasswordAuthClient } from "../admin/login";

export interface PedagogicalLeadLoginOptions {
  dataStore: AuthDataStore;
  authClient: PasswordAuthClient;
  email: string;
  password: string;
}

export interface PedagogicalLeadLoginResult {
  userId: string;
}

/**
 * Task 3.5: Pedagogical_Lead login. Same password-auth mechanism as Admin
 * (loginAdmin), but deliberately does NOT resolve or return a tenantId —
 * Pedagogical_Lead is a platform-level role, not scoped to any one school
 * (Requirement 4.8 / design.md's RLS Policy Special Case), and returning a
 * tenantId here would invite a caller to (incorrectly) tenant-scope this
 * session downstream.
 */
export async function loginPedagogicalLead(
  options: PedagogicalLeadLoginOptions,
): Promise<PedagogicalLeadLoginResult> {
  const { data, error } = await options.authClient.auth.signInWithPassword({
    email: options.email,
    password: options.password,
  });

  if (error || !data.user) {
    throw new AuthError(AUTH_ERROR_CODES.INVALID_CREDENTIALS, "Incorrect email or password.", 401);
  }

  const isPedagogicalLead = await options.dataStore.hasRole(data.user.id, "pedagogical_lead");
  if (!isPedagogicalLead) {
    await options.authClient.auth.signOut();
    throw new AuthError(
      AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
      "This account does not have Pedagogical_Lead access.",
      403,
    );
  }

  return { userId: data.user.id };
}
