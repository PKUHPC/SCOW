import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Server } from "@ddadaal/tsgrpc-server";
import { ChannelCredentials } from "@grpc/grpc-js";
import { decimalToMoney } from "@scow/lib-decimal";
import { GetTenantInfoResponse, TenantServiceClient } from "@scow/protos/build/server/tenant";
import { createServer } from "src/app";
import { InitialData, insertInitialData } from "tests/data/data";
import { dropDatabase } from "tests/data/helpers";

let server: Server;
let data: InitialData;

beforeEach(async () => {
  server = await createServer();

  const em = server.ext.orm.em.fork();

  data = await insertInitialData(em);

  await server.start();
});

afterEach(async () => {
  await dropDatabase(server.ext.orm);
  await server.close();
});

it("gets tenant info", async () => {
  const client = new TenantServiceClient(server.serverAddress, ChannelCredentials.createInsecure());

  const info = await asyncClientCall(client, "getTenantInfo", { tenantName: data.tenant.name });

  expect(info).toEqual({
    accountCount: 2,
    userCount: 2,
    balance: decimalToMoney(data.tenant.balance),
    defaultAccountBlockThreshold: decimalToMoney(data.tenant.defaultAccountBlockThreshold),
    admins: [data.userA].map((x) => ({ userId: x.userId, userName: x.name })),
    financialStaff: [],
  } as GetTenantInfoResponse);
});

it("gets all tenants", async () => {
  const client = new TenantServiceClient(server.serverAddress, ChannelCredentials.createInsecure());

  const info = await asyncClientCall(client, "getTenants", {});

  expect(info.names).toIncludeSameMembers([data.tenant.name, data.anotherTenant.name]);
});
