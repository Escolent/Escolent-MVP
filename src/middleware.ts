import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sw.js, workbox files, manifest, icons (PWA assets)
     */
    "/((?!_next/static|_next/image|favicon.ico|sw.js|workbox-|manifest.json|icons/).*)",
  ],
};
