import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Server } from "@ddadaal/tsgrpc-server";
import { ChannelCredentials, status } from "@grpc/grpc-js";
import {
  CreateInitAdminRequest,
  InitServiceClient,
  SetAsInitAdminRequest,
  UnsetInitAdminRequest,
} from "@scow/protos/build/server/init";
import { createServer } from "src/app";
import { Tenant } from "src/entities/Tenant";
import { PlatformRole, TenantRole, User } from "src/entities/User";
import { DEFAULT_TENANT_NAME } from "src/utils/constants";
import { createUserInDatabase } from "src/utils/createUser";
import { reloadEntities, toRef } from "src/utils/orm";
import { dropDatabase } from "tests/data/helpers";

let server: Server;
let client: InitServiceClient;

beforeEach(async () => {
  server = await createServer();
  await server.start();
  client = new InitServiceClient(server.serverAddress, ChannelCredentials.createInsecure());
});

afterEach(async () => {
  await dropDatabase(server.ext.orm);
  await server.close();
});

it("Test function userExist", async () => {
  const identityId = "test01";
  const name = "test01";
  const email = "test01@test01.com";
  const em = server.ext.orm.em.fork();
  const tenant = await em.findOneOrFail(Tenant, { name: DEFAULT_TENANT_NAME });
  await createUserInDatabase(identityId, name, email, tenant.name, server.logger, em);
  const result = await asyncClientCall(client, "userExists", {
    userId: identityId,
  });
  expect(result.existsInScow).toBe(true);
  expect(result.existsInAuth).toBe(true);
});

it("querys init state and updates if complete", async () => {
  const queryInitialized = async () => {
    const reply = await asyncClientCall(client, "querySystemInitialized", {});
    return reply.initialized;
  };

  expect(await queryInitialized()).toBeFalse();

  await asyncClientCall(client, "completeInit", {});
  expect(await queryInitialized()).toBeTrue();
});

it("fails to complete if already init", async () => {
  await asyncClientCall(client, "completeInit", {});

  try {
    await asyncClientCall(client, "completeInit", {});
    fail();
  } catch (e) {
    expect(e).toMatchObject({ code: status.ALREADY_EXISTS });
  }
});

it("creates an init admin user", async () => {
  const userInfo: CreateInitAdminRequest = {
    email: "test@test.com",
    name: "123",
    userId: "123",
    password: "pwd...123",
  };
  await asyncClientCall(client, "createInitAdmin", userInfo);

  const em = server.ext.orm.em.fork();

  const user = await em.findOneOrFail(User, { userId: userInfo.userId });

  expect(user).toMatchObject({
    email: userInfo.email,
    name: userInfo.name,
    userId: userInfo.userId,
  });
  expect(user.platformRoles).toIncludeSameMembers([PlatformRole.PLATFORM_ADMIN]);
  expect(user.tenantRoles).toIncludeSameMembers([TenantRole.TENANT_ADMIN]);
});

it("sets an user as platforn admin and tenant admin", async () => {
  // create an user
  const em = server.ext.orm.em.fork();
  const tenant = await em.findOneOrFail(Tenant, { name: DEFAULT_TENANT_NAME });

  const user = new User({ email: "test@test.com", name: "123", tenant: toRef(tenant), userId: "123" });
  await em.persistAndFlush(user);

  const request: SetAsInitAdminRequest = {
    userId: user.userId,
  };

  await asyncClientCall(client, "setAsInitAdmin", request);

  await reloadEntities(em, [user]);

  expect(user.platformRoles).toIncludeSameMembers([PlatformRole.PLATFORM_ADMIN]);
  expect(user.tenantRoles).toIncludeSameMembers([TenantRole.TENANT_ADMIN]);
});

it("unsets an user as platforn admin and tenant admin", async () => {
  // create an user
  const em = server.ext.orm.em.fork();
  const tenant = await em.findOneOrFail(Tenant, { name: DEFAULT_TENANT_NAME });

  const user = new User({
    email: "test@test.com",
    name: "123",
    tenant: toRef(tenant),
    userId: "123",
    platformRoles: [PlatformRole.PLATFORM_ADMIN],
    tenantRoles: [TenantRole.TENANT_ADMIN],
  });

  await em.persistAndFlush(user);

  const request: UnsetInitAdminRequest = {
    userId: user.userId,
  };

  await asyncClientCall(client, "unsetInitAdmin", request);

  await reloadEntities(em, [user]);

  expect(user.platformRoles).not.toInclude(PlatformRole.PLATFORM_ADMIN);
  expect(user.tenantRoles).not.toInclude(TenantRole.TENANT_ADMIN);
});
