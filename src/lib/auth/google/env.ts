export function getGoogleOAuthClientId(): string {
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!id) throw new Error("Missing required environment variable: GOOGLE_OAUTH_CLIENT_ID");
  return id;
}

export function getGoogleOAuthClientSecret(): string {
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!secret) throw new Error("Missing required environment variable: GOOGLE_OAUTH_CLIENT_SECRET");
  return secret;
}
