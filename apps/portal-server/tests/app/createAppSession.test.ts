import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { Server } from "@ddadaal/tsgrpc-server";
import { credentials, status } from "@grpc/grpc-js";
import { AppServiceClient } from "@scow/protos/build/portal/app";
import { createServer } from "src/app";

let server: Server;
let client: AppServiceClient;

beforeEach(async () => {
  server = await createServer();

  await server.start();

  client = new AppServiceClient(server.serverAddress, credentials.createInsecure());
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
