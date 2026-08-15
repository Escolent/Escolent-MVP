import { AUTH_ERROR_CODES, AuthError } from "@/lib/api/errors";
import type { FetchLike } from "./classroom";

export interface GoogleTokens {
  idToken: string;
  accessToken: string;
}

export interface ExchangeGoogleAuthCodeParams {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fetchImpl?: FetchLike;
}

/** Exchanges an OAuth2 authorization code for Google's id_token + access_token. */
export async function exchangeGoogleAuthCode(
  params: ExchangeGoogleAuthCodeParams,
): Promise<GoogleTokens> {
  const fetchImpl = params.fetchImpl ?? fetch;
  const response = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: params.code,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      redirect_uri: params.redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    throw new AuthError(
      AUTH_ERROR_CODES.INVALID_GOOGLE_TOKEN,
      "Failed to complete Google sign-in — the authorization code exchange failed.",
      401,
      { status: response.status },
    );
  }

  const data = (await response.json()) as { id_token?: string; access_token?: string };
  if (!data.id_token || !data.access_token) {
    throw new AuthError(
      AUTH_ERROR_CODES.INVALID_GOOGLE_TOKEN,
      "Google's token response was incomplete.",
      401,
    );
  }

  return { idToken: data.id_token, accessToken: data.access_token };
}
