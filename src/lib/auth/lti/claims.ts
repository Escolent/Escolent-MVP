import type { JWTPayload } from "jose";
import { AUTH_ERROR_CODES, AuthError } from "@/lib/api/errors";
import { LTI_CLAIM, LTI_ROLE_URI, type LtiLaunchClaims } from "./types";

function missingClaimError(claim: string): AuthError {
  return new AuthError(
    AUTH_ERROR_CODES.INVALID_LTI_JWT,
    `Your LTI launch could not be verified — required claim "${claim}" was missing.`,
    401,
    { cause: `missing_claim:${claim}` },
  );
}

/**
 * Maps a signature-verified LTI id_token payload to the fields Escolent
 * actually needs, failing loudly (missing-claim errors, not silent
 * defaults) on anything required but absent — including which of
 * Student/Teacher this launch is for, since getting that wrong would put a
 * Student in the Teacher dashboard or vice versa.
 */
export function parseLtiLaunchClaims(payload: JWTPayload): LtiLaunchClaims {
  const issuer = payload.iss;
  if (!issuer) throw missingClaimError("iss");

  const subject = payload.sub;
  if (!subject) throw missingClaimError("sub");

  const email = typeof payload.email === "string" ? payload.email : undefined;
  if (!email) throw missingClaimError("email");

  const deploymentId = payload[LTI_CLAIM.deploymentId];
  if (typeof deploymentId !== "string" || deploymentId.length === 0) {
    throw missingClaimError(LTI_CLAIM.deploymentId);
  }

  const rawRoles = payload[LTI_CLAIM.roles];
  if (!Array.isArray(rawRoles) || rawRoles.length === 0) {
    throw missingClaimError(LTI_CLAIM.roles);
  }
  const role = mapLtiRolesToEscolentRole(rawRoles);
  if (!role) {
    throw new AuthError(
      AUTH_ERROR_CODES.INVALID_LTI_JWT,
      "Your LTI launch did not include a recognized Student or Teacher role.",
      401,
      { cause: "unrecognized_role", roles: rawRoles },
    );
  }

  const rawContext = payload[LTI_CLAIM.context] as { id?: unknown; label?: unknown; title?: unknown } | undefined;
  if (!rawContext || typeof rawContext.id !== "string") {
    throw missingClaimError(LTI_CLAIM.context);
  }

  const fullName = typeof payload.name === "string" ? payload.name : null;
  const targetLinkUri =
    typeof payload[LTI_CLAIM.targetLinkUri] === "string" ? (payload[LTI_CLAIM.targetLinkUri] as string) : null;

  return {
    issuer,
    deploymentId,
    subject,
    email,
    fullName,
    role,
    course: {
      id: rawContext.id,
      label: typeof rawContext.label === "string" ? rawContext.label : undefined,
      title: typeof rawContext.title === "string" ? rawContext.title : undefined,
    },
    targetLinkUri,
  };
}

function mapLtiRolesToEscolentRole(roles: unknown[]): "student" | "teacher" | null {
  const roleSet = new Set(roles.filter((r): r is string => typeof r === "string"));
  // A launch could theoretically carry both role URIs; Instructor takes
  // precedence since course staff sometimes also hold a Learner role in
  // some LMS role configurations.
  if (roleSet.has(LTI_ROLE_URI.instructor)) return "teacher";
  if (roleSet.has(LTI_ROLE_URI.learner)) return "student";
  return null;
}
