import { buildAuthRequestUrl, generateStateAndNonce } from "@/lib/auth/lti/oidc";

describe("generateStateAndNonce", () => {
  it("generates distinct, non-empty values each call", () => {
    const a = generateStateAndNonce();
    const b = generateStateAndNonce();
    expect(a.state).not.toBe(b.state);
    expect(a.nonce).not.toBe(b.nonce);
    expect(a.state.length).toBeGreaterThan(20);
    expect(a.nonce.length).toBeGreaterThan(20);
  });
});

describe("buildAuthRequestUrl", () => {
  const baseParams = {
    request: {
      iss: "https://canvas.example.com",
      loginHint: "user-42",
      targetLinkUri: "https://escolent.app/practice",
    },
    authLoginUrl: "https://canvas.example.com/api/lti/authorize_redirect",
    clientId: "client-abc",
    redirectUri: "https://escolent.app/api/auth/lti/launch",
    state: "the-state",
    nonce: "the-nonce",
  };

  it("targets the Platform's auth endpoint with the required OIDC params", () => {
    const url = new URL(buildAuthRequestUrl(baseParams));

    expect(url.origin + url.pathname).toBe(
      "https://canvas.example.com/api/lti/authorize_redirect",
    );
    expect(url.searchParams.get("scope")).toBe("openid");
    expect(url.searchParams.get("response_type")).toBe("id_token");
    expect(url.searchParams.get("response_mode")).toBe("form_post");
    expect(url.searchParams.get("client_id")).toBe("client-abc");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://escolent.app/api/auth/lti/launch",
    );
    expect(url.searchParams.get("login_hint")).toBe("user-42");
    expect(url.searchParams.get("state")).toBe("the-state");
    expect(url.searchParams.get("nonce")).toBe("the-nonce");
  });

  it("forwards lti_deployment_id and lti_message_hint when the Platform sent them", () => {
    const url = new URL(
      buildAuthRequestUrl({
        ...baseParams,
        request: {
          ...baseParams.request,
          ltiDeploymentId: "deployment-7",
          ltiMessageHint: "hint-xyz",
        },
      }),
    );

    expect(url.searchParams.get("lti_deployment_id")).toBe("deployment-7");
    expect(url.searchParams.get("lti_message_hint")).toBe("hint-xyz");
  });

  it("omits lti_deployment_id/lti_message_hint entirely when absent, rather than sending empty values", () => {
    const url = new URL(buildAuthRequestUrl(baseParams));
    expect(url.searchParams.has("lti_deployment_id")).toBe(false);
    expect(url.searchParams.has("lti_message_hint")).toBe(false);
  });
});
