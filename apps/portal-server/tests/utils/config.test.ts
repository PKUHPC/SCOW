import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { Server } from "@ddadaal/tsgrpc-server";
import { getClientFn } from "@scow/lib-server";
import { ConfigServiceClient } from "@scow/protos/build/common/config";
import { readFileSync } from "fs";
import { join } from "path";
import { createServer } from "src/app";
import { commonConfig } from "src/config/common";

let server: Server;
let client: ConfigServiceClient;

beforeEach(async () => {
  server = await createServer();

  await server.start();

  client = getClientFn(server.serverAddress, commonConfig.scowApi.auth.token)(ConfigServiceClient);
});

afterEach(async () => {
  await server.close();
});

it("get scow version configs info", async () => {
  const reply = await asyncUnaryCall(client, "getApiVersion", {});

  const version = await JSON.parse(
    readFileSync(join(__dirname, "../../node_modules/@scow/protos/package.json"), "utf-8"),
  ).version;
  const [major, minor, patch] = version.split(".").map(Number);
  console.log(version);
  expect(reply.major).toBe(major);
  expect(reply.minor).toBe(minor);
  expect(reply.patch).toBe(patch);
});
