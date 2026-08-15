import {
  buildGoogleAuthUrl,
  generateCsrfToken,
  parseGoogleStateParam,
} from "@/lib/auth/google/oauthUrl";

describe("Google OAuth URL + state param", () => {
  it("builds a consent URL with the required params", () => {
    const url = new URL(
      buildGoogleAuthUrl({
        clientId: "client-abc",
        redirectUri: "https://escolent.app/api/auth/google/callback",
        courseId: "course-123",
        csrf: "csrf-xyz",
      }),
    );

    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("client-abc");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://escolent.app/api/auth/google/callback",
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toContain("classroom.rosters.readonly");
  });

  it("round-trips courseId and csrf through the state param", () => {
    const url = new URL(
      buildGoogleAuthUrl({
        clientId: "client-abc",
        redirectUri: "https://escolent.app/api/auth/google/callback",
        courseId: "course-123",
        csrf: "csrf-xyz",
      }),
    );

    const state = url.searchParams.get("state");
    expect(state).toBeTruthy();
    const parsed = parseGoogleStateParam(state as string);
    expect(parsed).toEqual({ csrf: "csrf-xyz", courseId: "course-123" });
  });

  it("generates distinct csrf tokens", () => {
    expect(generateCsrfToken()).not.toBe(generateCsrfToken());
  });

  it("rejects a malformed state param rather than returning partial data", () => {
    expect(() => parseGoogleStateParam(Buffer.from("not json").toString("base64url"))).toThrow();
  });
});
