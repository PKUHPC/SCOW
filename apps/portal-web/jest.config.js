/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * OPENSCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

const dotenv = require("dotenv");
dotenv.config({ path: "env/.env.test" });

const nextJest = require("next/jest");
const { pathsToModuleNameMapper } = require("ts-jest");
const { compilerOptions } = require("./tsconfig.json");

const { buildRuntimeConfig } = require("./config.js");
const { PHASE_TEST } = require("next/constants");

const BASE_PATH = (!process.env.BASE_PATH || process.env.BASE_PATH === "/") ? "" : process.env.BASE_PATH;

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = async () => {


  const createJestConfig = nextJest({
    // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
    dir: "./",
  });

  // build runtime config
  const runtimeConfig = await buildRuntimeConfig(PHASE_TEST, BASE_PATH);

  /**
   * @type {import("jest").Config}
   */
  // Add any custom config to be passed to Jest
  const customJestConfig = {
    // Add more setup options before each test is run
    // setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    // if using TypeScript with a baseUrl set to the root directory then you need the below for alias' to work
    moduleDirectories: ["node_modules", "<rootDir>/"],
    testEnvironment: "jest-environment-jsdom",
    setupFilesAfterEnv: ["jest-extended/all"],
    moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, { prefix: "<rootDir>/" }),
    globals: { __NEXT_RUNTIME_CONFIG__: runtimeConfig },
  };

  return createJestConfig(customJestConfig)();
};
