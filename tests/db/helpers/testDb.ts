import { Pool, type PoolClient } from "pg";

// `escolent`: the migration-owner role. Like Supabase's `postgres`/
// `service_role`, it owns every table and therefore bypasses RLS — use it
// only to seed fixture data and to assert on raw schema structure.
const OWNER_URL =
  process.env.TEST_DATABASE_URL ||
  "postgres://escolent:escolent_dev_pw@127.0.0.1:5432/escolent_test";

// `escolent_app_user`: stands in for Supabase's `authenticated` role. It is
// granted table-level DML in tests/db/fixtures/grants.sql but is NOT a
// table owner, so RLS policies actually apply to it — this is the role
// every RLS-enforcement test must run as.
const APP_URL =
  process.env.TEST_DATABASE_APP_URL ||
  "postgres://escolent_app_user:escolent_app_pw@127.0.0.1:5432/escolent_test";

let ownerPool: Pool | undefined;
let appPool: Pool | undefined;

export function getOwnerPool(): Pool {
  if (!ownerPool) ownerPool = new Pool({ connectionString: OWNER_URL });
  return ownerPool;
}

export function getAppPool(): Pool {
  if (!appPool) appPool = new Pool({ connectionString: APP_URL });
  return appPool;
}

/**
 * Runs `fn` inside a transaction on the app (RLS-subject) role, with
 * `auth.uid()` stubbed to resolve to `userId` for the duration — mirroring
 * how PostgREST sets `request.jwt.claims` per-request on Supabase. The
 * transaction is always rolled back afterwards so tests stay isolated from
 * each other. Pass `null` to simulate an unauthenticated request.
 */
export async function asUser<T>(
  userId: string | null,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getAppPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      userId ? JSON.stringify({ sub: userId }) : "",
    ]);
    return await fn(client);
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
    client.release();
  }
}

/** Runs `fn` with the table-owner role (bypasses RLS) — for seeding fixtures. */
export async function asOwner<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getOwnerPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function closeTestDb(): Promise<void> {
  await ownerPool?.end();
  await appPool?.end();
  ownerPool = undefined;
  appPool = undefined;
}
