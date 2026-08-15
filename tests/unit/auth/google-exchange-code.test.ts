import { exchangeGoogleAuthCode } from "@/lib/auth/google/exchangeCode";
import { AuthError } from "@/lib/api/errors";
import type { FetchLike } from "@/lib/auth/google/classroom";

function jsonFetch(status: number, body: unknown): FetchLike {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })) as FetchLike;
}

describe("exchangeGoogleAuthCode", () => {
  const params = {
    code: "auth-code-123",
    clientId: "client-abc",
    clientSecret: "secret-xyz",
    redirectUri: "https://escolent.app/api/auth/google/callback",
  };

  it("returns the id_token and access_token on success", async () => {
    const result = await exchangeGoogleAuthCode({
      ...params,
      fetchImpl: jsonFetch(200, { id_token: "the-id-token", access_token: "the-access-token" }),
    });
    expect(result).toEqual({ idToken: "the-id-token", accessToken: "the-access-token" });
  });

  it("throws when Google's response is non-2xx", async () => {
    await expect(
      exchangeGoogleAuthCode({ ...params, fetchImpl: jsonFetch(400, { error: "invalid_grant" }) }),
    ).rejects.toMatchObject<Partial<AuthError>>({ code: "AUTH_INVALID_GOOGLE_TOKEN" });
  });

  it("throws when the response is missing a token", async () => {
    await expect(
      exchangeGoogleAuthCode({ ...params, fetchImpl: jsonFetch(200, { access_token: "only-one" }) }),
    ).rejects.toMatchObject<Partial<AuthError>>({ code: "AUTH_INVALID_GOOGLE_TOKEN" });
  });
});
