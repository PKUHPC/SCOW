// jest.config.js
const { pathsToModuleNameMapper } = require("ts-jest");
const { compilerOptions } = require("./tsconfig");

/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  rootDir: ".",
  preset: "ts-jest",
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, { prefix: "<rootDir>/" }),
  testMatch: ["<rootDir>/tests/**/*.test.ts?(x)"],
  coverageDirectory: "coverage",
  testTimeout: 30000,
  coverageReporters: ["lcov"],
  setupFilesAfterEnv: ["jest-extended/all"],
};
