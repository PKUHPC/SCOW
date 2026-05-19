import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { Server } from "@ddadaal/tsgrpc-server";
import { ChannelCredentials, status } from "@grpc/grpc-js";
import { HookServiceClient, HookServiceServer, HookServiceService } from "@scow/protos/build/hook/hook";
import { apiAuthPlugin } from "src/index";

let server: Server;

const scowApiToken = "scowApiToken";

const createServer = async (setToken: boolean) => {
  const server = new Server({
    host: "127.0.0.1",
    port: 0,
  });

  if (setToken) {
    await server.register(apiAuthPlugin({ auth: { token: scowApiToken } }));
  }

  server.addService<HookServiceServer>(HookServiceService, {
    onEvent: async () => {
      return [{}];
    },
  });

  return server;
};

afterEach(async () => {
  await server.close();
});

const callOptions = (token: string) => ({
  callInvocationTransformer: (props) => {
    props.metadata.add("authorization", `Bearer ${token}`);
    return props;
  },
});

const serverUrl = () => "127.0.0.1:" + server.port;

it("should pass if the token is correct", async () => {
  server = await createServer(true);

  await server.start();

  const client = new HookServiceClient(serverUrl(), ChannelCredentials.createInsecure(), callOptions(scowApiToken));

  await asyncUnaryCall(client, "onEvent", {});
});

it("should not pass if the token is incorrect", async () => {
  server = await createServer(true);

  await server.start();

  const client = new HookServiceClient(
    serverUrl(),
    ChannelCredentials.createInsecure(),
    callOptions(scowApiToken + "123"),
  );

  try {
    await asyncUnaryCall(client, "onEvent", {});
    expect("").fail("should not pass");
  } catch (e: any) {
    expect(e.code).toBe(status.UNAUTHENTICATED);
  }
});

it("should pass if the token is not set", async () => {
  server = await createServer(false);

  await server.start();

  const client = new HookServiceClient(serverUrl(), ChannelCredentials.createInsecure());

  await asyncUnaryCall(client, "onEvent", {});
});
