import dotenv from "dotenv";
dotenv.config();

import { readFileSync } from "fs";
import { join } from "path";
import { checkClusters } from "src/cmd/checkClusters";
import { checkConfig } from "src/cmd/checkConfig";
import { runCompose } from "src/cmd/compose";
import { createConfiguredClusterPaths } from "src/cmd/createConfiguredClusterPaths";
import { enterDb } from "src/cmd/db";
import { enterAiDb } from "src/cmd/enterAiDb";
import { enterAuditDb } from "src/cmd/enterAuditDb";
import { generateDockerComposeYml } from "src/cmd/generate";
import { init } from "src/cmd/init";
import { migrateFromScowDeployment } from "src/cmd/migrate";
import { updateCli } from "src/cmd/updateCli";
import { viewInstall } from "src/cmd/viewInstall";
import { logger } from "src/log";
import { hideBin } from "yargs/helpers";
import yargs from "yargs/yargs";

const version = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf-8")).version;

void yargs(hideBin(process.argv))
  .options({
    configPath: {
      alias: "c",
      type: "string",
      description: "Path to install config",
      default: "./install.yaml",
    },
  })
  .command(
    "view-install",
    "Extract install config",
    (yargs) => {
      return yargs.options({
        format: {
          alias: "f",
          type: "string",
          choices: ["yaml", "json"],
          description: "输出格式",
          default: "yaml",
        },
      });
    },
    (argv) => {
      viewInstall(argv);
    },
  )
  .command(
    "check-config",
    "Check SCOW config files",
    (yargs) => {
      return yargs.options({
        scowConfigPath: {
          type: "string",
          description: "The directory containing SCOW config files",
          default: "./config",
        },
        continueOnError: {
          type: "boolean",
          description: "Continue even a config has error",
          default: false,
        },
      });
    },
    (argv) => {
      checkConfig(argv);
    },
  )
  .command(
    "check-clusters",
    "Check connectivity to all configured scowd and adapters",
    (yargs) => {
      return yargs.options({
        scowConfigPath: {
          type: "string",
          description: "The directory containing SCOW config files",
          default: "./config",
        },
        continueOnError: {
          type: "boolean",
          description: "Continue checking even if an error occurs",
          default: false,
        },
      });
    },
    (argv) => {
      void checkClusters(argv);
    },
  )
  .command(
    "create-configured-cluster-paths",
    "Create configured cluster paths when missing",
    (yargs) => {
      return yargs.options({
        scowConfigPath: {
          type: "string",
          description: "The directory containing SCOW config files",
          default: "./config",
        },
      });
    },
    (argv) => {
      void createConfiguredClusterPaths(argv).catch((e) => {
        logger.error(e);
        process.exit(1);
      });
    },
  )
  .command(
    "init",
    "Extract sample config files",
    (yargs) => {
      return yargs.options({
        outputPath: {
          alias: "o",
          type: "string",
          description: "output path",
          default: ".",
        },
        full: {
          alias: "f",
          type: "boolean",
          description: "Extract full config files",
          default: false,
        },
      });
    },
    (argv) => {
      void init(argv);
    },
  )
  .command(
    "update",
    "Update cli",
    (yargs) => {
      return yargs.options({
        pr: {
          type: "number",
          description: "Pull request number",
          conflicts: ["branch", "version"],
        },
        branch: {
          type: "string",
          description: "Branch name",
          conflicts: ["pr", "version"],
        },
        release: {
          type: "string",
          description: "release version number (e.g. v0.3)",
          conflicts: ["branch", "pr"],
        },
        downloadPath: {
          alias: "o",
          type: "string",
          description: "Download path. If not specified, the cli itself will be replaced",
        },
      });
    },
    (argv) => {
      void updateCli(argv);
    },
  )
  .command(
    "generate",
    "Generate docker-compose.yml",
    (yargs) => {
      return yargs.options({
        outputPath: {
          alias: "o",
          type: "string",
          description: "输出路径",
          default: "./docker-compose.yml",
        },
        format: {
          alias: "f",
          type: "string",
          choices: ["yaml", "json"],
          description: "输出格式",
          default: "yaml",
        },
      });
    },
    (argv) => {
      generateDockerComposeYml(argv);
    },
  )
  .command(
    "db",
    "Enter mis db",
    (y) => y,
    (argv) => {
      void enterDb(argv);
    },
  )
  .command(
    "audit-db",
    "Enter audit db",
    (y) => y,
    (argv) => {
      void enterAuditDb(argv);
    },
  )
  .command(
    "ai-db",
    "Enter ai db",
    (y) => y,
    (argv) => {
      void enterAiDb(argv);
    },
  )
  .command(
    "compose",
    "Run  arbitrary compose commands",
    (y) => {
      return y.strict(false).parserConfiguration({ "unknown-options-as-args": true });
    },
    async (argv) => {
      await runCompose(argv);
    },
  )
  .command(
    "migrate",
    "Migrate from scow-deployment",
    (y) => {
      return y.options({
        configPyPath: {
          type: "string",
          description: "scow-deployment config.py file path",
          default: "./config.py",
        },
      });
    },
    (argv) => {
      migrateFromScowDeployment(argv);
    },
  )
  .completion()
  .strict()
  .scriptName("scow-cli")
  .demandCommand()
  .epilogue(`Version ${version}`)
  .epilogue("For more information, find our manual at https://pkuhpc.github.io/scow")
  .help()
  .parse();
