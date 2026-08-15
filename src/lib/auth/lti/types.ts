// LTI 1.3 standard claim URIs (IMS Global spec) we actually read.
export const LTI_CLAIM = {
  messageType: "https://purl.imsglobal.org/spec/lti/claim/message_type",
  version: "https://purl.imsglobal.org/spec/lti/claim/version",
  deploymentId: "https://purl.imsglobal.org/spec/lti/claim/deployment_id",
  roles: "https://purl.imsglobal.org/spec/lti/claim/roles",
  context: "https://purl.imsglobal.org/spec/lti/claim/context",
  targetLinkUri: "https://purl.imsglobal.org/spec/lti/claim/target_link_uri",
} as const;

// LIS v2 membership role URIs that map to Escolent roles. Institution-level
// roles exist too, but the course-membership role is what determines
// Student vs Teacher for a given launch.
export const LTI_ROLE_URI = {
  learner: "http://purl.imsglobal.org/vocab/lis/v2/membership#Learner",
  instructor: "http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor",
} as const;

export interface LtiCourseContext {
  id: string;
  label?: string;
  title?: string;
}

export interface LtiLaunchClaims {
  issuer: string;
  deploymentId: string;
  subject: string; // LTI 'sub' — stable per-user ID within the platform
  email: string;
  fullName: string | null;
  role: "student" | "teacher";
  course: LtiCourseContext;
  targetLinkUri: string | null;
}
