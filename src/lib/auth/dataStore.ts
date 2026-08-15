// Every auth flow (LTI, Google Classroom, Admin, Pedagogical_Lead) needs the
// same handful of operations: look up an LMS/Google mapping to resolve a
// tenant, and find-or-create the corresponding `public.users` +
// `user_roles` rows. Defining that surface as an interface (rather than
// calling supabase-js directly from the flow logic) means:
//
//   - Production code implements it once against Supabase (service-role,
//     since these lookups happen pre-session, before there's any auth.uid()
//     for RLS to key off) — see supabaseDataStore.ts.
//   - Tests implement it against a real local Postgres (the same harness
//     Task 1 built in tests/db/**), so the orchestration logic in
//     session.ts and lti/, google/, admin/, pedagogical-lead/ is exercised
//     against a real schema, not a hand-rolled mock — see
//     tests/db/helpers/pgAuthDataStore.ts.

export type Role = "student" | "teacher" | "admin" | "pedagogical_lead";

export interface LmsConfig {
  tenantId: string;
  lmsType: "canvas" | "moodle";
  issuer: string;
  clientId: string;
  deploymentId: string;
  jwksUrl: string;
  authLoginUrl: string;
}

export interface UpsertUserInput {
  // Every RLS policy from Task 1 compares `auth.uid()` (the Supabase Auth
  // JWT's `sub` claim) directly against `users.id`/`mastery_states.student_id`
  // /etc. — so `public.users.id` MUST equal the real Supabase Auth user's
  // id, never an independently generated UUID. Callers are responsible for
  // resolving that id (see resolveAuthUserId in supabaseDataStore.ts, or
  // the test doubles for tests) before calling upsertUser.
  id: string;
  tenantId: string | null; // null only for pedagogical_lead
  email: string;
  fullName?: string | null;
  lmsUserId?: string | null;
  googleClassroomId?: string | null;
}

export interface EscolentUser {
  id: string;
  tenantId: string | null;
  email: string;
}

export interface AuthDataStore {
  /** LTI: resolve which tenant a launch belongs to via (iss, deployment_id). */
  findLmsConfigByIssuerAndDeployment(
    issuer: string,
    deploymentId: string,
  ): Promise<LmsConfig | null>;

  /** Google Classroom: resolve which tenant a Workspace domain belongs to. */
  findTenantIdByGoogleWorkspaceDomain(domain: string): Promise<string | null>;

  /** Find-or-create the `public.users` row for this identity, scoped to tenantId. */
  upsertUser(input: UpsertUserInput): Promise<EscolentUser>;

  /** Idempotently ensure `user_roles` contains (userId, role, tenantId). */
  assignRole(userId: string, role: Role, tenantId: string | null): Promise<void>;

  /** Used by the Admin/Pedagogical_Lead flows, which authenticate via
   *  Supabase Auth email/password first and then need to confirm the
   *  resulting user actually holds the claimed role. */
  hasRole(userId: string, role: Role): Promise<boolean>;

  findUserByEmail(email: string): Promise<EscolentUser | null>;
}
