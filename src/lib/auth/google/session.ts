import { AUTH_ERROR_CODES, AuthError } from "@/lib/api/errors";
import type { AuthDataStore, EscolentUser } from "../dataStore";
import { verifyGoogleIdToken, type VerifyGoogleIdTokenOptions } from "./verifyIdToken";
import { fetchCourseRole, type FetchLike } from "./classroom";

export interface EstablishGoogleSessionOptions {
  dataStore: AuthDataStore;
  idToken: string;
  accessToken: string;
  courseId: string;
  audience: string;
  jwks?: VerifyGoogleIdTokenOptions["jwks"];
  fetchImpl?: FetchLike;
  /** Same contract as the LTI flow's — see src/lib/auth/lti/session.ts. */
  resolveAuthUserId: (email: string) => Promise<string>;
}

export interface EstablishGoogleSessionResult {
  user: EscolentUser;
  role: "student" | "teacher";
  tenantId: string;
  courseId: string;
}

/**
 * The full Google Classroom launch → Escolent session pipeline (task 3.3).
 * Unlike LTI, tenant is resolved from the ID token's `hd` (Google Workspace
 * hosted domain) claim rather than from a deployment identifier, and role
 * isn't in the token at all — it has to be looked up via the Classroom API
 * (task 3.3: "Extract user role... from Google Classroom API").
 */
export async function establishGoogleSession(
  options: EstablishGoogleSessionOptions,
): Promise<EstablishGoogleSessionResult> {
  const claims = await verifyGoogleIdToken(options.idToken, {
    audience: options.audience,
    jwks: options.jwks,
  });

  if (!claims.hostedDomain) {
    throw new AuthError(
      AUTH_ERROR_CODES.UNKNOWN_GOOGLE_DOMAIN,
      "Your Google account isn't part of a registered school Workspace domain.",
      401,
    );
  }

  const tenantId = await options.dataStore.findTenantIdByGoogleWorkspaceDomain(claims.hostedDomain);
  if (!tenantId) {
    throw new AuthError(
      AUTH_ERROR_CODES.UNKNOWN_GOOGLE_DOMAIN,
      "This Google Workspace domain is not registered with Escolent.",
      401,
      { domain: claims.hostedDomain },
    );
  }

  const role = await fetchCourseRole(
    options.accessToken,
    options.courseId,
    claims.subject,
    options.fetchImpl,
  );
  if (!role) {
    throw new AuthError(
      AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
      "You are not a teacher or student of this Google Classroom course.",
      403,
    );
  }

  const existingUser = await options.dataStore.findUserByEmail(claims.email);
  const authUserId = existingUser?.id ?? (await options.resolveAuthUserId(claims.email));
  const user = await options.dataStore.upsertUser({
    id: authUserId,
    tenantId,
    email: claims.email,
    fullName: claims.fullName,
    googleClassroomId: claims.subject,
  });
  await options.dataStore.assignRole(user.id, role, tenantId);

  return { user, role, tenantId, courseId: options.courseId };
}
