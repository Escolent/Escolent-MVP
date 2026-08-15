const nextJest = require("next/jest");

const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const customJestConfig = {
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testMatch: ["<rootDir>/tests/db/**/*.test.ts"],
  globalSetup: "<rootDir>/tests/db/globalSetup.js",
  testTimeout: 30000,
};

module.exports = createJestConfig(customJestConfig);
