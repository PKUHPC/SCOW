import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Server } from "@ddadaal/tsgrpc-server";
import { ChannelCredentials } from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { AppType as HpcAppType } from "@scow/config/build/app";
import { AppType as AiAppType } from "@scow/config/build/appForAi";
import {
  AppAuthorizationServiceClient,
  AppScope,
  AuthorizeAppRequest_AuthorizeAction,
  GetTargetAppAuthorizationsRequest_TargetType,
} from "@scow/protos/build/server/app_authorization";
import { createServer } from "src/app";
import { configClusters } from "src/config/clusters";
import { AccountAppBlacklist } from "src/entities/AccountAppBlacklist";
import { AppScope as EntityAppScope } from "src/entities/AppScope";
import { TenantAppBlacklist } from "src/entities/TenantAppBlacklist";
import { TenantDefaultAppRemovedList } from "src/entities/TenantDefaultAppRemovedList";
import * as appUtils from "src/utils/app";
import { DEFAULT_TENANT_NAME } from "src/utils/constants";
import { insertInitialData } from "tests/data/data";
import { dropDatabase } from "tests/data/helpers";

let server: Server | undefined;
let client: AppAuthorizationServiceClient;
const originalPlatformEnabled = Object.fromEntries(
  ["hpc00", "hpc01", "hpc02"].map((clusterId) => [
    clusterId,
    { hpc: configClusters[clusterId].hpc.enabled, ai: configClusters[clusterId].ai.enabled },
  ]),
);

const setPlatformEnabled = (clusterId: string, hpcEnabled: boolean, aiEnabled: boolean) => {
  configClusters[clusterId].hpc.enabled = hpcEnabled;
  configClusters[clusterId].ai.enabled = aiEnabled;
};

beforeAll(() => {
  jest.spyOn(appUtils, "getClusterAppConfigs").mockReturnValue({
    "shared-app": { name: "HPC Shared App", type: HpcAppType.web },
  });
  jest.spyOn(appUtils, "getAiClusterAppConfigs").mockReturnValue({
    "shared-app": { name: "AI Shared App", type: AiAppType.web },
  });

  setPlatformEnabled("hpc00", true, false);
  setPlatformEnabled("hpc01", false, true);
  setPlatformEnabled("hpc02", true, true);
});

afterAll(() => {
  jest.restoreAllMocks();
  for (const [clusterId, enabled] of Object.entries(originalPlatformEnabled)) {
    setPlatformEnabled(clusterId, enabled.hpc, enabled.ai);
  }
});

beforeEach(async () => {
  server = undefined;
  const createdServer = await createServer();
  server = createdServer;
  await insertInitialData(createdServer.ext.orm.em.fork());
  await createdServer.start();
  client = new AppAuthorizationServiceClient(createdServer.serverAddress, ChannelCredentials.createInsecure());
});

afterEach(async () => {
  const currentServer = server;
  server = undefined;
  if (currentServer) {
    await dropDatabase(currentServer.ext.orm);
    await currentServer.close();
  }
});

const getTenantAuthorizations = (clusterId: string, appScope?: AppScope) =>
  asyncClientCall(client, "getTargetAppAuthorizations", {
    clusterId,
    appScope,
    page: 1,
    pageSize: 20,
    targetType: GetTargetAppAuthorizationsRequest_TargetType.TENANT,
  });

it("infers HPC when appScope is omitted and only HPC is enabled", async () => {
  const reply = await getTenantAuthorizations("hpc00");

  expect(reply.appLists).not.toBeEmpty();
  expect(reply.appLists[0].appsInfo).toIncludeSameMembers([
    { appId: "shared-app", appName: "HPC Shared App", isDisabled: false },
  ]);
});

it("infers AI when appScope is omitted and only AI is enabled", async () => {
  const reply = await getTenantAuthorizations("hpc01");

  expect(reply.appLists).not.toBeEmpty();
  expect(reply.appLists[0].appsInfo).toIncludeSameMembers([
    { appId: "shared-app", appName: "AI Shared App", isDisabled: false },
  ]);
});

it("requires appScope when both HPC and AI are enabled", async () => {
  const error = await getTenantAuthorizations("hpc02").catch((e) => e);

  expect(error.code).toBe(Status.INVALID_ARGUMENT);
  expect(error.details).toContain("both HPC and AI applications are enabled");
});

it("uses the explicit appScope in a hybrid cluster", async () => {
  const [hpcReply, aiReply] = await Promise.all([
    getTenantAuthorizations("hpc02", AppScope.HPC),
    getTenantAuthorizations("hpc02", AppScope.AI),
  ]);

  expect(hpcReply.appLists[0].appsInfo[0].appName).toBe("HPC Shared App");
  expect(aiReply.appLists[0].appsInfo[0].appName).toBe("AI Shared App");
});

it("stores same appId independently for HPC and AI account authorization", async () => {
  const request = {
    clusterId: "hpc02",
    appId: "shared-app",
    operatorId: "a",
    action: AuthorizeAppRequest_AuthorizeAction.UNAUTHORIZE,
    target: { $case: "accountName" as const, accountName: "hpca" },
  };

  await asyncClientCall(client, "authorizeApp", { ...request, appScope: AppScope.HPC });
  await asyncClientCall(client, "authorizeApp", { ...request, appScope: AppScope.AI });

  const em = server!.ext.orm.em.fork();
  const blacklists = await em.find(AccountAppBlacklist, {
    cluster: { clusterId: "hpc02" },
    account: { accountName: "hpca" },
    appId: "shared-app",
  });
  expect(blacklists.map((item) => item.appScope)).toIncludeSameMembers([EntityAppScope.HPC, EntityAppScope.AI]);

  await asyncClientCall(client, "authorizeApp", {
    ...request,
    appScope: AppScope.HPC,
    action: AuthorizeAppRequest_AuthorizeAction.AUTHORIZE,
  });

  em.clear();
  const remaining = await em.find(AccountAppBlacklist, {
    cluster: { clusterId: "hpc02" },
    account: { accountName: "hpca" },
    appId: "shared-app",
  });
  expect(remaining).toHaveLength(1);
  expect(remaining[0].appScope).toBe(EntityAppScope.AI);
});

it("treats repeated tenant unauthorization as success without duplicate records", async () => {
  const request = {
    clusterId: "hpc02",
    appScope: AppScope.HPC,
    appId: "shared-app",
    operatorId: "a",
    action: AuthorizeAppRequest_AuthorizeAction.UNAUTHORIZE,
    target: { $case: "tenantName" as const, tenantName: DEFAULT_TENANT_NAME },
  };

  const first = await asyncClientCall(client, "authorizeApp", request);
  const second = await asyncClientCall(client, "authorizeApp", request);
  expect(first.executed).toBeTrue();
  expect(second.executed).toBeTrue();

  const em = server!.ext.orm.em.fork();
  const accountRows = await em.count(AccountAppBlacklist, {
    cluster: { clusterId: "hpc02" },
    account: { tenant: { name: DEFAULT_TENANT_NAME } },
    appScope: EntityAppScope.HPC,
    appId: "shared-app",
  });
  const tenantRows = await em.count(TenantAppBlacklist, {
    cluster: { clusterId: "hpc02" },
    tenant: { name: DEFAULT_TENANT_NAME },
    appScope: EntityAppScope.HPC,
    appId: "shared-app",
  });
  const removedDefaultRows = await em.count(TenantDefaultAppRemovedList, {
    cluster: { clusterId: "hpc02" },
    tenant: { name: DEFAULT_TENANT_NAME },
    appScope: EntityAppScope.HPC,
    appId: "shared-app",
  });

  expect(accountRows).toBe(2);
  expect(tenantRows).toBe(1);
  expect(removedDefaultRows).toBe(1);
});
