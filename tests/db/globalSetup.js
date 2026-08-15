// Jest globalSetup for tests/db/**: applies the real Supabase migrations
// (supabase/migrations/*.sql) plus test-only fixtures to a local Postgres
// database, once per test run, before any test file connects.
//
// Requires a local Postgres reachable at TEST_DATABASE_URL (see
// scripts/db/setup-local-test-db.sh for one-time role/database creation).
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const OWNER_URL =
  process.env.TEST_DATABASE_URL ||
  "postgres://escolent:escolent_dev_pw@127.0.0.1:5432/escolent_test";

const MIGRATIONS_DIR = path.join(__dirname, "..", "..", "supabase", "migrations");
const FIXTURES_DIR = path.join(__dirname, "fixtures");

function readSql(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

module.exports = async function globalSetup() {
  const client = new Client({ connectionString: OWNER_URL });
  await client.connect();

  try {
    // Start from a clean slate so the migrations are the only source of
    // schema state (mirrors running `supabase db reset` against a fresh
    // project).
    await client.query("drop schema if exists public cascade;");
    await client.query("create schema public;");
    await client.query("drop schema if exists auth cascade;");

    await client.query(readSql(path.join(FIXTURES_DIR, "auth-stub.sql")));

    const migrationFiles = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of migrationFiles) {
      try {
        await client.query(readSql(path.join(MIGRATIONS_DIR, file)));
      } catch (err) {
        throw new Error(`Migration ${file} failed: ${err.message}`);
      }
    }

    await client.query(readSql(path.join(FIXTURES_DIR, "grants.sql")));
  } finally {
    await client.end();
  }
};
