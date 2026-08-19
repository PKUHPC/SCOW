import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { Server } from "@ddadaal/tsgrpc-server";
import { status } from "@grpc/grpc-js";
import { AttributeType, FileSelectionType } from "@scow/config/build/app";
import { getClusterConfigs } from "@scow/config/build/cluster";
import { getClientFn } from "@scow/lib-server";
import { AppServiceClient } from "@scow/protos/build/portal/app";
import { createServer } from "src/app";
import * as clusterOpsModule from "src/clusterops";
import { FileType } from "src/clusterops/api/file";
import { commonConfig } from "src/config/common";
import * as appUtils from "src/utils/app";

jest.mock("src/utils/clusters", () => ({
  ...jest.requireActual("src/utils/clusters"),
  checkActivatedClusters: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("src/utils/validation", () => ({
  ...jest.requireActual("src/utils/validation"),
  validateSubmitJobInfoUnderMis: jest.fn().mockResolvedValue(undefined),
}));

let server: Server;
let client: AppServiceClient;

beforeEach(async () => {
  server = await createServer();

  await server.start();

  client = getClientFn(server.serverAddress, commonConfig.scowApi.auth.token)(AppServiceClient);
});

afterEach(async () => {
  jest.restoreAllMocks();
  await server.close();
});

function mockFileApp(metadataType: FileType, selectionType = FileSelectionType.file, constrained = true) {
  const apps = appUtils.getClusterAppConfigs("hpc01");
  const clusterOps = clusterOpsModule.getClusterOps("hpc01");

  if (!clusterOps) {
    throw new Error("cluster hpc01 is not configured");
  }

  const getFileMetadata = jest.fn().mockResolvedValue({
    size: 1,
    type: metadataType,
    isSymlink: metadataType === FileType.SYMLINK,
  });
  const createApp = jest.fn().mockResolvedValue({ jobId: 1, sessionId: "session-1" });

  jest.spyOn(appUtils, "getClusterAppConfigs").mockReturnValue({
    ...apps,
    vscode: {
      ...apps.vscode,
      attributes: [
        ...(apps.vscode.attributes ?? []),
        {
          type: AttributeType.file,
          name: "scriptPath",
          label: "Script",
          required: true,
          file: constrained
            ? {
                selectionType,
                extensions: selectionType === FileSelectionType.file ? [".sh", ".tar.gz"] : undefined,
              }
            : undefined,
        },
      ],
    },
  });
  jest.spyOn(clusterOpsModule, "getClusterOps").mockReturnValue({
    ...clusterOps,
    file: { ...clusterOps.file, getFileMetadata },
    app: { ...clusterOps.app, createApp },
  });

  return { createApp, getFileMetadata };
}

const validCreateRequest = {
  appId: "vscode",
  appJobName: "vscode-20220101-080000",
  cluster: "hpc01",
  userId: "123",
  nodeCount: 1,
  coreCount: 2,
  account: "b",
  maxTime: 60,
  partition: "default",
  qos: "high",
  proxyBasePath: "/api/proxy",
};

it("create app with wrong argument", async () => {
  const reply = await asyncUnaryCall(client, "createAppSession", {
    appId: "vscode",
    appJobName: "vscode-20220101-080000",
    cluster: "hpc01",
    userId: "123",
    nodeCount: 1,
    coreCount: 2,
    account: "b",
    maxTime: 60,
    partition: "default",
    qos: "high",
    proxyBasePath: "/api/proxy",
    customAttributes: { version5: "abc" },
  }).catch((e) => e as { code: number });

  expect((reply as { code: number }).code).toBe(status.INVALID_ARGUMENT);
});

it("rejects app creation when max running time exceeds cluster limit", async () => {
  const clusterConfigs = getClusterConfigs(undefined, console, ["hpc"]);
  const originalLimit = clusterConfigs.hpc01?.hpc.app?.maxRunningTimeHours;

  if (!clusterConfigs.hpc01) {
    throw new Error("cluster hpc01 is not configured");
  }

  clusterConfigs.hpc01.hpc.app = { ...(clusterConfigs.hpc01.hpc.app ?? {}), maxRunningTimeHours: 1 };

  const reply = await asyncUnaryCall(client, "createAppSession", {
    appId: "vscode",
    appJobName: "vscode-20220101-080000",
    cluster: "hpc01",
    userId: "123",
    nodeCount: 1,
    coreCount: 2,
    account: "b",
    maxTime: 61,
    partition: "default",
    qos: "high",
    proxyBasePath: "/api/proxy",
    customAttributes: { version5: "abc" },
  }).catch((e) => e as { code: number });

  if (originalLimit === undefined) {
    delete clusterConfigs.hpc01.hpc.app?.maxRunningTimeHours;
  } else {
    clusterConfigs.hpc01.hpc.app = { ...(clusterConfigs.hpc01.hpc.app ?? {}), maxRunningTimeHours: originalLimit };
  }

  expect((reply as { code: number }).code).toBe(status.INVALID_ARGUMENT);
});

it("rejects a disallowed extension without querying metadata", async () => {
  const { createApp, getFileMetadata } = mockFileApp(FileType.FILE);

  const reply = await asyncUnaryCall(client, "createAppSession", {
    ...validCreateRequest,
    customAttributes: {
      version5: "code-server/4.8.0",
      scriptPath: "/home/user/start.py",
    },
  }).catch((error) => error as { code: number });

  expect((reply as { code: number }).code).toBe(status.INVALID_ARGUMENT);
  expect(getFileMetadata).not.toHaveBeenCalled();
  expect(createApp).not.toHaveBeenCalled();
});

it.each([
  [FileSelectionType.file, FileType.DIR, "/home/user/start.sh"],
  [FileSelectionType.directory, FileType.FILE, "/home/user/work"],
])("rejects a mismatched metadata type in %s mode", async (selectionType, metadataType, path) => {
  const { createApp } = mockFileApp(metadataType, selectionType);

  const reply = await asyncUnaryCall(client, "createAppSession", {
    ...validCreateRequest,
    customAttributes: {
      version5: "code-server/4.8.0",
      scriptPath: path,
    },
  }).catch((error) => error as { code: number });

  expect((reply as { code: number }).code).toBe(status.INVALID_ARGUMENT);
  expect(createApp).not.toHaveBeenCalled();
});

it.each([
  [FileSelectionType.file, FileType.FILE, "/home/user/start.TAR.GZ"],
  [FileSelectionType.directory, FileType.DIR, "/home/user/work"],
])("creates the app when the path matches %s mode", async (selectionType, metadataType, path) => {
  const { createApp, getFileMetadata } = mockFileApp(metadataType, selectionType);

  const reply = await asyncUnaryCall(client, "createAppSession", {
    ...validCreateRequest,
    customAttributes: {
      version5: "code-server/4.8.0",
      scriptPath: path,
    },
  });

  expect(reply).toEqual({ jobId: 1, sessionId: "session-1" });
  expect(getFileMetadata).toHaveBeenCalledWith({ userId: "123", path }, expect.anything());
  expect(createApp).toHaveBeenCalledTimes(1);
});

it("keeps an unconfigured file attribute on the legacy path", async () => {
  const { createApp, getFileMetadata } = mockFileApp(FileType.FILE, FileSelectionType.file, false);

  await asyncUnaryCall(client, "createAppSession", {
    ...validCreateRequest,
    customAttributes: {
      version5: "code-server/4.8.0",
      scriptPath: "/path/that/does/not/need/to/exist",
    },
  });

  expect(getFileMetadata).not.toHaveBeenCalled();
  expect(createApp).toHaveBeenCalledTimes(1);
});
