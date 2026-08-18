import { getLoginNode, LoginNodeConfigSchema } from "@scow/config/build/cluster";
import { promises as fsp } from "fs";
import { dump, load } from "js-yaml";
import { join } from "path";
import { checkConfig } from "src/cmd/checkConfig";
import { logger } from "src/log";
import { createInstallYaml, testBaseFolder } from "tests/utils";

const SCOW_API_TOKEN_PLACEHOLDER = "must-change-this-scow-api-token";
const VALID_SCOW_API_TOKEN = "test-scow-api-token-at-least-32-chars";

async function copyConfig() {
  await fsp.cp("assets/init/config", testBaseFolder, { recursive: true });
  const commonConfigPath = join(testBaseFolder, "common.yaml");
  const commonConfig = await fsp.readFile(commonConfigPath, "utf8");
  await fsp.writeFile(commonConfigPath, commonConfig.replace(SCOW_API_TOKEN_PLACEHOLDER, VALID_SCOW_API_TOKEN));
}

async function updateClusterConfig(update: (config: Record<string, any>) => void) {
  const clusterConfigPath = join(testBaseFolder, "clusters/hpc01.yaml");
  const clusterConfig = load(await fsp.readFile(clusterConfigPath, "utf8")) as Record<string, any>;
  update(clusterConfig);
  await fsp.writeFile(clusterConfigPath, dump(clusterConfig));
}

function getConfigErrors() {
  return jest.spyOn(logger, "error").mockImplementation();
}

it.each([
  ["MIS", "mis.yaml"],
  ["audit", "audit.yaml"],
  ["resource", "resource/config.yaml"],
  ["notification", "notification/config.yaml"],
])("reports a missing required %s config file", async (_, relativePath) => {
  await copyConfig();
  const installPath = await createInstallYaml({});
  await fsp.rm(join(testBaseFolder, relativePath));

  const errorSpy = jest.spyOn(logger, "error").mockImplementation();

  checkConfig({
    configPath: installPath,
    scowConfigPath: testBaseFolder,
    continueOnError: true,
  });

  const errorMessages = errorSpy.mock.calls
    .flat()
    .map((value) => (value instanceof Error ? value.message : String(value)))
    .join("\n");
  errorSpy.mockRestore();

  expect(errorMessages).toContain(relativePath.replace(/\.ya?ml$/, ""));
});

it.each([
  ["scowApi.auth.token", "/scowApi/auth/token"],
  ["scowResource.address", "/scowResource/address"],
  ["notification.name", "/notification/name"],
  ["notification.address", "/notification/address"],
])("rejects an empty required config value at %s", async (fieldPath, expectedErrorPath) => {
  await copyConfig();
  const installPath = await createInstallYaml({});
  const commonConfig = {
    passwordPattern: { regex: "test", errorMessage: "test" },
    scowApi: { auth: { token: VALID_SCOW_API_TOKEN } },
    scowResource: { address: "http://resource:3000/resource" },
    notification: { name: "notification", address: "http://notification:3000/notification" },
  };

  const pathParts = fieldPath.split(".");
  const fieldName = pathParts.pop()!;
  const target = pathParts.reduce<Record<string, unknown>>((current, key) => {
    return current[key] as Record<string, unknown>;
  }, commonConfig);
  target[fieldName] = "";

  await fsp.writeFile(join(testBaseFolder, "common.yaml"), dump(commonConfig));

  const errorSpy = jest.spyOn(logger, "error").mockImplementation();

  checkConfig({
    configPath: installPath,
    scowConfigPath: testBaseFolder,
    continueOnError: true,
  });

  const errorMessages = errorSpy.mock.calls
    .flat()
    .map((value) => (value instanceof Error ? value.message : String(value)))
    .join("\n");
  errorSpy.mockRestore();

  expect(errorMessages).toContain(expectedErrorPath);
});

it("rejects a SCOW API token shorter than 32 characters", async () => {
  await copyConfig();
  const installPath = await createInstallYaml({});
  const commonConfig = {
    passwordPattern: { regex: "test", errorMessage: "test" },
    scowApi: { auth: { token: "a".repeat(31) } },
    scowResource: { address: "http://resource:3000/resource" },
    notification: { name: "notification", address: "http://notification:3000/notification" },
  };
  await fsp.writeFile(join(testBaseFolder, "common.yaml"), dump(commonConfig));
  const errorSpy = getConfigErrors();

  checkConfig({
    configPath: installPath,
    scowConfigPath: testBaseFolder,
    continueOnError: true,
  });

  expect(errorSpy.mock.calls.flat().join("\n")).toContain("/scowApi/auth/token must NOT have fewer than 32 characters");
  errorSpy.mockRestore();
});

it("ignores the removed cluster scowd.enabled field", async () => {
  await copyConfig();
  const installPath = await createInstallYaml({});
  await updateClusterConfig((config) => {
    config.scowd = { enabled: false };
  });
  const errorSpy = getConfigErrors();

  checkConfig({
    configPath: installPath,
    scowConfigPath: testBaseFolder,
    continueOnError: true,
  });

  expect(errorSpy).not.toHaveBeenCalled();
  errorSpy.mockRestore();
});

it("rejects a login node without a scowd port", async () => {
  await copyConfig();
  const installPath = await createInstallYaml({});
  await updateClusterConfig((config) => {
    delete config.loginNodes[0].scowd.port;
  });
  const errorSpy = getConfigErrors();

  checkConfig({
    configPath: installPath,
    scowConfigPath: testBaseFolder,
    continueOnError: true,
  });

  expect(errorSpy.mock.calls.flat().join("\n")).toContain("/loginNodes/0/scowd must have required property 'port'");
  errorSpy.mockRestore();
});

it.each([
  ["missing login nodes", undefined, "must have required property 'loginNodes'"],
  ["an empty login node list", [], "/loginNodes must NOT have fewer than 1 items"],
])("rejects a cluster with %s", async (_, loginNodes, expectedError) => {
  await copyConfig();
  const installPath = await createInstallYaml({});
  await updateClusterConfig((config) => {
    if (loginNodes === undefined) {
      delete config.loginNodes;
    } else {
      config.loginNodes = loginNodes;
    }
  });
  const errorSpy = getConfigErrors();

  checkConfig({
    configPath: installPath,
    scowConfigPath: testBaseFolder,
    continueOnError: true,
  });

  expect(errorSpy.mock.calls.flat().join("\n")).toContain(expectedError);
  errorSpy.mockRestore();
});

it.each([
  ["zero", 0, "must be >= 1"],
  ["a negative number", -1, "must be >= 1"],
  ["a decimal", 1.5, "must be integer"],
  ["a number above 65535", 65536, "must be <= 65535"],
])("rejects %s as a scowd port", async (_, port, expectedError) => {
  await copyConfig();
  const installPath = await createInstallYaml({});
  await updateClusterConfig((config) => {
    config.loginNodes[0].scowd.port = port;
  });
  const errorSpy = getConfigErrors();

  checkConfig({
    configPath: installPath,
    scowConfigPath: testBaseFolder,
    continueOnError: true,
  });

  const errors = errorSpy.mock.calls.flat().join("\n");
  expect(errors).toContain("/loginNodes/0/scowd/port");
  expect(errors).toContain(expectedError);
  errorSpy.mockRestore();
});

it.each([1, 9999, 65535])("accepts %d as a scowd port", async (port) => {
  await copyConfig();
  const installPath = await createInstallYaml({});
  await updateClusterConfig((config) => {
    config.loginNodes[0].scowd.port = port;
  });
  const errorSpy = getConfigErrors();

  checkConfig({
    configPath: installPath,
    scowConfigPath: testBaseFolder,
    continueOnError: true,
  });

  expect(errorSpy).not.toHaveBeenCalled();
  errorSpy.mockRestore();
});

it("reports the required scowd port when converting an invalid login node", () => {
  const loginNode = { name: "login01", address: "login01" } as LoginNodeConfigSchema;

  expect(() => getLoginNode(loginNode)).toThrow(
    'Login node "login01" is missing required configuration "loginNodes[].scowd.port".',
  );
});

it("rejects the legacy string login node format", async () => {
  await copyConfig();
  const installPath = await createInstallYaml({});
  await updateClusterConfig((config) => {
    config.loginNodes = ["login01"];
  });
  const errorSpy = getConfigErrors();

  checkConfig({
    configPath: installPath,
    scowConfigPath: testBaseFolder,
    continueOnError: true,
  });

  expect(errorSpy.mock.calls.flat().join("\n")).toContain("/loginNodes/0 must be object");
  errorSpy.mockRestore();
});
