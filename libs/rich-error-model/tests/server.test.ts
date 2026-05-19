import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { Server } from "@ddadaal/tsgrpc-server";
import { ChannelCredentials, ServiceError, status } from "@grpc/grpc-js";
import { HookServiceClient, HookServiceServer, HookServiceService } from "@scow/protos/build/hook/hook";

import { DetailedError, encodeMessage, ErrorInfo, LocalizedMessage, parseErrorStatus } from "../src";

let server: Server;

const errorMessage = "The expected error message";

const errorInfo = { domain: "test.com", reason: "123", metadata: { test1: "test" } };
const localizedMessage = { locale: "zh-CN", message: "123" };

function createServer() {
  const server = new Server({
    host: "localhost",
    port: 0,
  });

  server.addService<HookServiceServer>(HookServiceService, {
    onEvent: async ({ request }) => {
      if (request.event?.$case === "userAdded") {
        throw new DetailedError({
          code: status.ALREADY_EXISTS,
          message: errorMessage,
          details: [encodeMessage(ErrorInfo, errorInfo), encodeMessage(LocalizedMessage, localizedMessage)],
        });
      }
      if (request.event?.$case === "accountBlocked") {
        throw new Error("Normal error");
      }

      return [{}];
    },
  });

  return server;
}

beforeEach(async () => {
  server = createServer();

  await server.start();
});

afterEach(async () => {
  await server.close();
});

const createClient = () => new HookServiceClient("127.0.0.1:" + server.port, ChannelCredentials.createInsecure());

it("throws and catches ErrorDetails", async () => {
  try {
    await asyncUnaryCall(createClient(), "onEvent", {
      metadata: { time: new Date().toISOString() },
      event: { $case: "userAdded", userAdded: { tenantName: "123", userId: "123" } },
    });

    expect("").fail("should not pass");
  } catch (e) {
    const ex = e as ServiceError;

    const { findDetails } = parseErrorStatus(ex.metadata);
    expect(ex.details).toBe(errorMessage);

    const errors: ErrorInfo[] = findDetails(ErrorInfo);

    expect(errors).toIncludeAllMembers([ErrorInfo.fromPartial(errorInfo)]);

    expect(findDetails(LocalizedMessage) satisfies LocalizedMessage[]).toIncludeAllMembers([
      LocalizedMessage.fromPartial(localizedMessage),
    ]);
  }
});

it("does not interfere with normal error", async () => {
  try {
    await asyncUnaryCall(createClient(), "onEvent", {
      metadata: { time: new Date().toISOString() },
      event: { $case: "accountBlocked", accountBlocked: { accountName: "123", tenantName: "123" } },
    });

    expect("").fail("should not pass");
  } catch (e) {
    const ex = e as ServiceError;
    expect(ex.details).toBe("Normal error");
    const errors = parseErrorStatus(ex.metadata).findDetails(ErrorInfo);
    expect(errors).toHaveLength(0);
  }
});
