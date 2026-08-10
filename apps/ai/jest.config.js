const { pathsToModuleNameMapper } = require("ts-jest");

const { compilerOptions } = require("./tsconfig.json");

/** @type {import("jest").Config} */
module.exports = {
  preset: "ts-jest",
  testMatch: ["<rootDir>/tests/**/*.test.ts?(x)"],
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, { prefix: "<rootDir>/" }),
  setupFilesAfterEnv: ["jest-extended/all"],
};
