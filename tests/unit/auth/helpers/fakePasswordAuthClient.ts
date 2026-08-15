import { randomUUID } from "node:crypto";
import type { PasswordAuthClient } from "@/lib/auth/admin/login";

export function fakePasswordAuthClient(overrides: {
  userId?: string;
  signInError?: string;
}): PasswordAuthClient {
  return {
    auth: {
      async signInWithPassword() {
        if (overrides.signInError) {
          return { data: { user: null }, error: { message: overrides.signInError } };
        }
        return { data: { user: { id: overrides.userId ?? randomUUID() } }, error: null };
      },
      async signOut() {
        return { error: null };
      },
    },
  };
}
