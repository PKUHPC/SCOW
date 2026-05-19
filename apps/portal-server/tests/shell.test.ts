import { asyncDuplexStreamCall } from "@ddadaal/tsgrpc-client";
import { Server } from "@ddadaal/tsgrpc-server";
import { credentials } from "@grpc/grpc-js";
import { ShellResponse, ShellServiceClient } from "@scow/protos/build/portal/shell";
import { createServer } from "src/app";
import {
  cluster,
  collectInfo,
  connectToTestServer,
  createTestItems,
  resetTestServer,
  target,
  TestSshServer,
  userId,
} from "tests/file/utils";

let ssh: TestSshServer;
let server: Server;
let client: ShellServiceClient;

beforeEach(async () => {
  ssh = await connectToTestServer();
  await createTestItems(ssh);

  server = await createServer();
  await server.start();

  client = new ShellServiceClient(server.serverAddress, credentials.createInsecure());
});

afterEach(async () => {
  await resetTestServer(ssh);
  await server.close();
});

// TODO passes locally but not on CI
it.skip("tests shell interaction", async () => {
  const stream = asyncDuplexStreamCall(client, "shell");

  await stream.writeAsync({ message: { $case: "connect", connect: { cluster, loginNode: target, userId } } });

  // types commands
  const type = "echo 123\nexit\n";
  await stream.writeAsync({ message: { $case: "data", data: { data: Uint8Array.from(Buffer.from(type)) } } });

  // collect output
  const data = await collectInfo<ShellResponse>(stream);

  // expect the output
  const actual = data.reduce((prev, curr) => {
    if (curr.message?.$case === "data") {
      prev.push(curr.message.data.data);
    }
    return prev;
  }, [] as Uint8Array[]);

  const expected = [] as Uint8Array[];

  // expectation
  await ssh.ssh.withShell(async (channel) => {
    channel.write(type);

    for await (const chunk of channel) {
      expected.push(chunk);
    }
  });

  const actualString = Buffer.concat(actual).toString();
  const expectedString = Buffer.concat(expected).toString();

  expect(actualString).toEqual(expectedString);
});
