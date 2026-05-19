import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { Server } from "@ddadaal/tsgrpc-server";
import { credentials } from "@grpc/grpc-js";
import { ClusterConfigSchema, getClusterConfigs } from "@scow/config/build/cluster";
import { ConfigServiceClient } from "@scow/protos/build/common/config";
import { createServer } from "src/app";
import { logger } from "src/utils/logger";
import { getI18nTypeFormat, getLoginNodesTypeFormat } from "tests/file/utils";

let server: Server;
let client: ConfigServiceClient;

beforeEach(async () => {
  server = await createServer();

  await server.start();

  client = new ConfigServiceClient(server.serverAddress, credentials.createInsecure());
});

afterEach(async () => {
  await server.close();
});

it("get cluster configs info", async () => {
  const clusterConfigsByReadingFiles = getClusterConfigs(undefined, logger, ["hpc"]);

  const reply = await asyncUnaryCall(client, "getClusterConfigFiles", {});

  const clusterConfigsResp = reply.clusterConfigs;

  const modifiedClusters: Record<string, ClusterConfigSchema> = {};
  clusterConfigsResp.forEach((cluster) => {
    const { clusterId, ...rest } = cluster;
    const newCluster = {
      ...rest,
      displayName: getI18nTypeFormat(cluster.displayName),
      loginNodes: !cluster.loginNodes ? [] : getLoginNodesTypeFormat(cluster.loginNodes),
    };
    modifiedClusters[cluster.clusterId] = newCluster as ClusterConfigSchema;
  });

  expect(modifiedClusters).toEqual(clusterConfigsByReadingFiles);
});
