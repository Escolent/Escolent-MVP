const nextJest = require("next/jest");

const createJestConfig = nextJest({
  // Path to Next.js app to load next.config.js and .env files.
  dir: "./",
});

/** @type {import('jest').Config} */
const customJestConfig = {
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  // DB-backed tests (tests/db/**) spin up against a real local Postgres and
  // apply the Supabase migrations; keep them out of the default fast unit
  // run and invoke them explicitly via `npm run test:db`.
  testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/", "<rootDir>/tests/db/"],
};

module.exports = createJestConfig(customJestConfig);
