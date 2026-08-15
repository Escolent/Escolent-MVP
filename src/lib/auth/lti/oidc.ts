import { randomBytes } from "node:crypto";

// Query params the Platform (Canvas/Moodle) sends to our OIDC login
// initiation endpoint (LTI 1.3 "third-party initiated login").
export interface LtiLoginRequest {
  iss: string;
  loginHint: string;
  targetLinkUri: string;
  clientId?: string; // optional per spec when a platform has only one client per iss
  ltiDeploymentId?: string;
  ltiMessageHint?: string;
}

export interface BuildAuthRequestUrlParams {
  request: LtiLoginRequest;
  authLoginUrl: string;
  clientId: string;
  redirectUri: string; // our /api/auth/lti/launch endpoint
  state: string;
  nonce: string;
}

export function generateStateAndNonce(): { state: string; nonce: string } {
  return {
    state: randomBytes(32).toString("base64url"),
    nonce: randomBytes(32).toString("base64url"),
  };
}

/** Builds the redirect URL to the Platform's OIDC authorization endpoint. */
export function buildAuthRequestUrl(params: BuildAuthRequestUrlParams): string {
  const url = new URL(params.authLoginUrl);
  url.searchParams.set("scope", "openid");
  url.searchParams.set("response_type", "id_token");
  url.searchParams.set("response_mode", "form_post");
  url.searchParams.set("prompt", "none");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("login_hint", params.request.loginHint);
  url.searchParams.set("state", params.state);
  url.searchParams.set("nonce", params.nonce);
  if (params.request.ltiDeploymentId) {
    url.searchParams.set("lti_deployment_id", params.request.ltiDeploymentId);
  }
  if (params.request.ltiMessageHint) {
    url.searchParams.set("lti_message_hint", params.request.ltiMessageHint);
  }
  return url.toString();
}
