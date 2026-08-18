import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Server } from "@ddadaal/tsgrpc-server";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { moneyToNumber, numberToMoney } from "@scow/lib-decimal";
import { AccountServiceClient } from "@scow/protos/build/server/account";
import { AdminServiceClient } from "@scow/protos/build/server/admin";
import { ChargingServiceClient } from "@scow/protos/build/server/charging";
import {
  ClusterActivationStatus as ClusterActivationStatusProto,
  ConfigServiceClient,
} from "@scow/protos/build/server/config";
import { createServer } from "src/app";
import { Account, AccountState } from "src/entities/Account";
import { Cluster, ClusterActivationStatus } from "src/entities/Cluster";
import { reloadEntity } from "src/utils/orm";
import { InitialData, insertInitialData } from "tests/data/data";
import { dropDatabase } from "tests/data/helpers";
import { createTestClient, mockAccountResourceOperations } from "tests/utils";

jest.mock("src/utils/scowd", () => {
  const actual = jest.requireActual("src/utils/scowd");

  return {
    ...actual,
    getScowdClient: jest.fn(() => ({
      system: {
        checkHealth: jest.fn().mockResolvedValue({}),
      },
    })),
  };
});

let server: Server;
let client: ConfigServiceClient;
let clusterItem: Cluster;
let data: InitialData;

beforeEach(async () => {
  server = await createServer();
  mockAccountResourceOperations(server.ext.resource);
  data = await insertInitialData(server.ext.orm.em.fork());
  await server.start();

  clusterItem = new Cluster({
    clusterId: "hpcTest",
    activationStatus: ClusterActivationStatus.DEACTIVATED,
    lastActivationOperation: { operatorId: "userA", deactivationComment: "Deactivation Comment" },
  });
  const hpc00 = await server.ext.orm.em.fork().findOneOrFail(Cluster, {
    clusterId: "hpc00",
  });
  hpc00.activationStatus = ClusterActivationStatus.DEACTIVATED;
  hpc00.lastActivationOperation = {
    operatorId: "userB",
    deactivationComment: "new deactivation message for upgrade",
  };

  await server.ext.orm.em.fork().persistAndFlush([clusterItem, hpc00]);

  client = createTestClient(server.serverAddress, ConfigServiceClient);
});

afterEach(async () => {
  await dropDatabase(server.ext.orm);
  await server.close();
});

it("gets clusters initial database info", async () => {
  const clustersRuntimeInfo = await asyncClientCall(client, "getClustersRuntimeInfo", {});

  expect(clustersRuntimeInfo.results.length).toEqual(4);
  expect(
    clustersRuntimeInfo.results.map((x) => ({
      clusterId: x.clusterId,
      activationStatus: x.activationStatus,
      lastActivationOperation: x.lastActivationOperation,
    })),
  ).toIncludeSameMembers([
    {
      clusterId: "hpc00",
      activationStatus: ClusterActivationStatusProto.DEACTIVATED,
      lastActivationOperation: {
        operatorId: "userB",
        deactivationComment: "new deactivation message for upgrade",
      },
    },
    {
      clusterId: "hpc01",
      activationStatus: ClusterActivationStatusProto.ACTIVATED,
      lastActivationOperation: undefined,
    },
    {
      clusterId: "hpc02",
      activationStatus: ClusterActivationStatusProto.ACTIVATED,
      lastActivationOperation: undefined,
    },
    {
      clusterId: "hpcTest",
      activationStatus: ClusterActivationStatusProto.DEACTIVATED,
      lastActivationOperation: { operatorId: "userA", deactivationComment: "Deactivation Comment" },
    },
  ]);
});

it("cannot activate a cluster if the schedular adapter is not reachable", async () => {
  const reply = await asyncClientCall(client, "activateCluster", {
    clusterId: "hpcTest",
    operatorId: "userB",
  }).catch((e) => e);
  expect(reply.code).toBe(Status.FAILED_PRECONDITION);
});

it("cannot write to db when activated a cluster has already been activated", async () => {
  const reply = await asyncClientCall(client, "activateCluster", {
    clusterId: "hpc01",
    operatorId: "userB",
  });

  expect(reply.executed).toBeFalse();

  const activatedCluster = await server.ext.orm.em.fork().findOneOrFail(Cluster, {
    clusterId: "hpc01",
  });

  expect(activatedCluster.lastActivationOperation).toBeUndefined();
});

it("activates a cluster", async () => {
  const reply = await asyncClientCall(client, "activateCluster", {
    clusterId: "hpc00",
    operatorId: "userC",
  });
  expect(reply.executed).toBeTrue();

  const updatedCluster = await server.ext.orm.em.fork().findOneOrFail(Cluster, {
    clusterId: "hpc00",
  });
  expect(updatedCluster.activationStatus).toBe(ClusterActivationStatus.ACTIVATED);
  expect(updatedCluster.lastActivationOperation).toStrictEqual({
    operatorId: "userC",
  });
});

it("cannot deactivate a cluster if not found", async () => {
  const reply = await asyncClientCall(client, "deactivateCluster", {
    clusterId: "hpc123",
    operatorId: "userA",
    deactivationComment: "deactivation for upgrade",
  }).catch((e) => e);
  expect(reply.code).toBe(Status.NOT_FOUND);
});

it("cannot write to db when deactivated a cluster has already been deactivated", async () => {
  const reply = await asyncClientCall(client, "deactivateCluster", {
    clusterId: "hpcTest",
    operatorId: "userB",
    deactivationComment: "deactivation for upgrade",
  });

  expect(reply.executed).toBeFalse();

  const deactivatedCluster = await server.ext.orm.em.fork().findOneOrFail(Cluster, {
    clusterId: "hpcTest",
  });
  expect(deactivatedCluster.activationStatus).toBe(ClusterActivationStatus.DEACTIVATED);
  expect(deactivatedCluster.lastActivationOperation).toStrictEqual({
    operatorId: "userA",
    deactivationComment: "Deactivation Comment",
  });
});

it("deactivates a cluster", async () => {
  const reply = await asyncClientCall(client, "deactivateCluster", {
    clusterId: "hpc01",
    operatorId: "userB",
    deactivationComment: "deactivation message for upgrade",
  });
  expect(reply.executed).toBeTrue();

  const deactivatedCluster = await server.ext.orm.em.fork().findOneOrFail(Cluster, {
    clusterId: "hpc01",
  });
  expect(deactivatedCluster.activationStatus).toBe(ClusterActivationStatus.DEACTIVATED);
  expect(deactivatedCluster.lastActivationOperation).toStrictEqual({
    operatorId: "userB",
    deactivationComment: "deactivation message for upgrade",
  });
});

it("creates an account and executes pay operation successfully during cluster activation operation", async () => {
  const reply = await asyncClientCall(client, "deactivateCluster", {
    clusterId: "hpc01",
    operatorId: "userB",
    deactivationComment: "deactivation message for upgrade",
  });
  expect(reply.executed).toBeTrue();

  const accountClient = createTestClient(server.serverAddress, AccountServiceClient);

  await asyncClientCall(accountClient, "createAccount", {
    accountName: "a1234",
    tenantName: data.tenant.name,
    ownerId: data.userA.userId,
  });
  const em = server.ext.orm.em.fork();

  const account = await em.findOneOrFail(Account, { accountName: "a1234" });
  expect(account.accountName).toBe("a1234");
  expect(account.balance.toNumber()).toBe(0);
  expect(account.state).toBe(AccountState.NORMAL);
  expect(account.blockedInCluster).toBe(true);

  const amount = numberToMoney(10);

  const chargeClient = createTestClient(server.serverAddress, ChargingServiceClient);

  const payReply = await asyncClientCall(chargeClient, "pay", {
    tenantName: data.tenant.name,
    accountName: "a1234",
    amount: amount,
    comment: "comment",
    operatorId: "tester",
    ipAddress: "127.0.0.1",
    type: "test",
  });

  expect(moneyToNumber(payReply.previousBalance!)).toBe(0);
  expect(moneyToNumber(payReply.currentBalance!)).toBe(10);

  await reloadEntity(em, account);

  expect(account.balance.toNumber()).toBe(10);
  expect(account.blockedInCluster).toBeFalse();
});

it("cannot execute pay operation during all clusters were deactivated", async () => {
  // create account
  const accountClient = createTestClient(server.serverAddress, AccountServiceClient);

  await asyncClientCall(accountClient, "createAccount", {
    accountName: "a1234",
    tenantName: data.tenant.name,
    ownerId: data.userA.userId,
  });
  const em = server.ext.orm.em.fork();

  const account = await em.findOneOrFail(Account, { accountName: "a1234" });
  expect(account.accountName).toBe("a1234");
  expect(account.balance.toNumber()).toBe(0);
  expect(account.state).toBe(AccountState.NORMAL);
  expect(account.blockedInCluster).toBeTrue();

  // deactivate all clusters
  const deactivationReply1 = await asyncClientCall(client, "deactivateCluster", {
    clusterId: "hpc01",
    operatorId: "userB",
    deactivationComment: "deactivation message for upgrade",
  });
  expect(deactivationReply1.executed).toBeTrue();

  const deactivationReply2 = await asyncClientCall(client, "deactivateCluster", {
    clusterId: "hpc02",
    operatorId: "userB",
    deactivationComment: "deactivation message for upgrade",
  });
  expect(deactivationReply2.executed).toBeTrue();

  // pay operation
  const amount = numberToMoney(10);

  const chargeClient = createTestClient(server.serverAddress, ChargingServiceClient);

  const payReply = await asyncClientCall(chargeClient, "pay", {
    tenantName: data.tenant.name,
    accountName: "a1234",
    amount: amount,
    comment: "comment",
    operatorId: "tester",
    ipAddress: "127.0.0.1",
    type: "test",
  }).catch((e) => e);

  expect(payReply.code).toBe(Status.INTERNAL);
  expect(payReply.details).toBe("No available clusters. Please try again later");
});

it("creates an account and executes charge operation successfully during cluster activation operation", async () => {
  // create an account
  const accountClient = createTestClient(server.serverAddress, AccountServiceClient);

  await asyncClientCall(accountClient, "createAccount", {
    accountName: "a1234",
    tenantName: data.tenant.name,
    ownerId: data.userA.userId,
  });
  const em = server.ext.orm.em.fork();

  const account = await em.findOneOrFail(Account, { accountName: "a1234" });
  expect(account.accountName).toBe("a1234");
  expect(account.balance.toNumber()).toBe(0);
  expect(account.state).toBe(AccountState.NORMAL);
  expect(account.blockedInCluster).toBe(true);

  // deactivate a cluster
  const reply = await asyncClientCall(client, "deactivateCluster", {
    clusterId: "hpc01",
    operatorId: "userB",
    deactivationComment: "deactivation message for upgrade",
  });
  expect(reply.executed).toBe(true);

  // charge
  const amount = numberToMoney(10);

  const chargeClient = createTestClient(server.serverAddress, ChargingServiceClient);

  const chargeReply = await asyncClientCall(chargeClient, "charge", {
    tenantName: data.tenant.name,
    accountName: "a1234",
    type: "123",
    amount: amount,
    comment: "comment",
  });

  expect(moneyToNumber(chargeReply.previousBalance!)).toBe(0);
  expect(moneyToNumber(chargeReply.currentBalance!)).toBe(-10);

  await reloadEntity(em, account);

  expect(account.balance.toNumber()).toBe(-10);
  expect(account.blockedInCluster).toBeTruthy();
  expect(account.state).toBe(AccountState.NORMAL);
  expect(account.blockedInCluster).toBeTrue();
});

it("cannot execute charge operation during all clusters were deactivated", async () => {
  // create account
  const accountClient = createTestClient(server.serverAddress, AccountServiceClient);

  await asyncClientCall(accountClient, "createAccount", {
    accountName: "a1234",
    tenantName: data.tenant.name,
    ownerId: data.userA.userId,
  });
  const em = server.ext.orm.em.fork();

  const account = await em.findOneOrFail(Account, { accountName: "a1234" });
  expect(account.accountName).toBe("a1234");
  expect(account.balance.toNumber()).toBe(0);
  expect(account.state).toBe(AccountState.NORMAL);
  expect(account.blockedInCluster).toBeTrue();

  // deactivate all clusters
  const deactivationReply1 = await asyncClientCall(client, "deactivateCluster", {
    clusterId: "hpc01",
    operatorId: "userB",
    deactivationComment: "deactivation message for upgrade",
  });
  expect(deactivationReply1.executed).toBeTrue();

  const deactivationReply2 = await asyncClientCall(client, "deactivateCluster", {
    clusterId: "hpc02",
    operatorId: "userB",
    deactivationComment: "deactivation message for upgrade",
  });
  expect(deactivationReply2.executed).toBeTrue();

  // pay operation
  const amount = numberToMoney(10);

  const chargeClient = createTestClient(server.serverAddress, ChargingServiceClient);

  const chargeReply = await asyncClientCall(chargeClient, "charge", {
    tenantName: data.tenant.name,
    accountName: "a1234",
    type: "123",
    amount: amount,
    comment: "comment",
  }).catch((e) => e);

  expect(chargeReply.code).toBe(Status.INTERNAL);
  expect(chargeReply.details).toBe("No available clusters. Please try again later");
});

it("cannot import users and accounts during all clusters were deactivated", async () => {
  const data = {
    accounts: [
      {
        accountName: "a_user1",
        users: [
          { userId: "user1", userName: "user1Name", blocked: false },
          { userId: "user2", userName: "user2", blocked: true },
        ],
        owner: "user1",
        blocked: false,
      },
      {
        accountName: "account2",
        users: [
          { userId: "user2", userName: "user2", blocked: false },
          { userId: "user3", userName: "user3", blocked: true },
        ],
        owner: "user2",
        blocked: false,
      },
    ],
  };

  // deactivate all clusters
  const deactivationReply1 = await asyncClientCall(client, "deactivateCluster", {
    clusterId: "hpc01",
    operatorId: "userB",
    deactivationComment: "deactivation message for upgrade",
  });
  expect(deactivationReply1.executed).toBeTrue();

  const deactivationReply2 = await asyncClientCall(client, "deactivateCluster", {
    clusterId: "hpc02",
    operatorId: "userB",
    deactivationComment: "deactivation message for upgrade",
  });
  expect(deactivationReply2.executed).toBeTrue();

  const adminClient = createTestClient(server.serverAddress, AdminServiceClient);
  const importReply = await asyncClientCall(adminClient, "importUsers", { data: data, whitelist: true }).catch(
    (e) => e,
  );

  expect(importReply.code).toBe(Status.INTERNAL);
  expect(importReply.details).toBe("No available clusters. Please try again later");
});
