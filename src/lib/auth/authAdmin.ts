import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Finds or creates the Supabase Auth user for `email` and returns its id.
 * Callers should check `AuthDataStore.findUserByEmail` FIRST and only fall
 * back to this when there's no existing `public.users` row — that row's id
 * IS the Supabase Auth user's id (see the comment on UpsertUserInput.id),
 * so once it exists there's no need to ask Supabase Auth again.
 *
 * supabase-js's admin API has no direct "get user by email," so on the
 * (per the above, rare) case where the email is already registered, this
 * falls back to paging through listUsers. MVP pilot scale (hundreds of
 * users, not millions) makes that acceptable.
 */
export async function resolveAuthUserId(admin: SupabaseClient, email: string): Promise<string> {
  const created = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (created.data.user) return created.data.user.id;

  const perPage = 200;
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = data.users.find((u) => u.email === email);
    if (match) return match.id;
    if (data.users.length < perPage) break;
  }

  throw created.error ?? new Error(`Could not resolve or create an auth user for ${email}`);
}
