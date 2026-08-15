import { NextResponse } from "next/server";
import { getToolPublicJwks } from "@/lib/auth/lti/toolKeys";

// Reads LTI_TOOL_PRIVATE_JWK at request time — must not be statically
// evaluated/pre-rendered at build time, when that secret isn't available.
export const dynamic = "force-dynamic";

export async function GET() {
  const jwks = getToolPublicJwks();
  // JWKS documents are safe (and expected) to be cached — public keys don't
  // change on every request.
  return NextResponse.json(jwks, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
