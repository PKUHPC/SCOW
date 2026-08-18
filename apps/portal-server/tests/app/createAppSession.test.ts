import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { Server } from "@ddadaal/tsgrpc-server";
import { status } from "@grpc/grpc-js";
import { getClientFn } from "@scow/lib-server";
import { AppServiceClient } from "@scow/protos/build/portal/app";
import { getClusterConfigs } from "@scow/config/build/cluster";
import { createServer } from "src/app";
import { commonConfig } from "src/config/common";

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
  await server.close();
});

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
