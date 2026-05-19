import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Server } from "@ddadaal/tsgrpc-server";
import { ChannelCredentials } from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { createUser } from "@scow/lib-auth";
import { decimalToMoney } from "@scow/lib-decimal";
import { TenantServiceClient } from "@scow/protos/build/server/tenant";
import { createServer } from "src/app";
import { authUrl } from "src/config";
import { Tenant } from "src/entities/Tenant";
import { TenantRole, User } from "src/entities/User";
import { insertInitialData } from "tests/data/data";
import { dropDatabase } from "tests/data/helpers";

let server: Server;
let client: TenantServiceClient;

beforeEach(async () => {
  server = await createServer();
  await server.start();
  client = new TenantServiceClient(server.serverAddress, ChannelCredentials.createInsecure());
});

afterEach(async () => {
  await dropDatabase(server.ext.orm);
  await server.close();
});

it("get all tenants", async () => {
  const data = await insertInitialData(server.ext.orm.em.fork());
  const tenants = await asyncClientCall(client, "getAllTenants", {});

  expect(tenants.totalCount).toEqual(2);
  expect(
    tenants.platformTenants.map((x) => ({
      tenantId: x.tenantId,
      name: x.tenantName,
      userCount: x.userCount,
      accountCount: x.accountCount,
      balance: x.balance,
      createTime: x.createTime,
    })),
  ).toIncludeSameMembers([
    {
      tenantId: data.tenant.id,
      name: data.tenant.name,
      userCount: 2,
      accountCount: 2,
      balance: decimalToMoney(data.tenant.balance),
      createTime: data.tenant.createTime.toISOString(),
    },
    {
      tenantId: data.anotherTenant.id,
      name: data.anotherTenant.name,
      userCount: 1,
      accountCount: 1,
      balance: decimalToMoney(data.anotherTenant.balance),
      createTime: data.anotherTenant.createTime.toISOString(),
    },
  ]);
});

const tenantName = "tenantTest";
const userId = "userIdTest";
const userName = "userNameTest";
const userEmail = "test@test.com";
const userPassword = "passwordTest";
const anotherTenantName = "anotherTenantTest";

it("cannot create a tenant if the name exists", async () => {
  const tenant = new Tenant({ name: tenantName });
  await server.ext.orm.em.fork().persistAndFlush(tenant);

  const reply = await asyncClientCall(client, "createTenant", {
    tenantName,
    userId,
    userName,
    userEmail,
    userPassword,
  }).catch((e) => e);
  expect(reply.code).toBe(Status.ALREADY_EXISTS);
  expect(reply.details).toBe("TENANT_ALREADY_EXISTS");
});

it("cannot create a tenant if the user exists", async () => {
  const tenant = new Tenant({ name: anotherTenantName });
  const user = new User({ name: userName, userId, email: userEmail, tenant });
  const em = server.ext.orm.em.fork();
  await em.persistAndFlush(tenant);
  await em.persistAndFlush(user);

  const reply = await asyncClientCall(client, "createTenant", {
    tenantName,
    userId,
    userName,
    userEmail,
    userPassword,
  }).catch((e) => e);
  expect(reply.code).toBe(Status.ALREADY_EXISTS);
  expect(reply.details).toBe("USER_ALREADY_EXISTS");
});

it("create a new tenant", async () => {
  await asyncClientCall(client, "createTenant", { tenantName, userId, userName, userEmail, userPassword });
  const em = server.ext.orm.em.fork();
  const tenant = await em.findOneOrFail(Tenant, { name: "tenantTest" });
  expect(tenant.name).toBe("tenantTest");

  const user = await em.findOneOrFail(User, { userId: "userIdTest" });
  expect(user.name).toBe("userNameTest");

  expect(user.tenantRoles.includes(TenantRole.TENANT_ADMIN)).toBe(true);

  expect(createUser).toHaveBeenNthCalledWith(
    1,
    authUrl,
    {
      identityId: userId,
      id: user.id,
      mail: userEmail,
      name: userName,
      password: userPassword,
    },
    expect.anything(),
  );
});
