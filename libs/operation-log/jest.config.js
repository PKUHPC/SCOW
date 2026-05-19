// In the following statement, replace `./tsconfig` with the path to your `tsconfig` file
// which contains the path mapping (ie the `compilerOptions.paths` option):

/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  rootDir: ".",
  preset: "ts-jest",
  testMatch: ["<rootDir>/tests/**/*.test.ts?(x)"],
  coverageDirectory: "coverage",
  testTimeout: 30000,
  coverageReporters: ["lcov"],
};
