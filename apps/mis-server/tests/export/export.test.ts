/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { asyncReplyStreamCall } from "@ddadaal/tsgrpc-client";
import { Server } from "@ddadaal/tsgrpc-server";
import { ChannelCredentials } from "@grpc/grpc-js";
import { SqlEntityManager } from "@mikro-orm/mysql";
import { Decimal, decimalToMoney } from "@scow/lib-decimal";
import { JobInfo as JobInfoProto } from "@scow/protos/build/common/ended_job";
import { Account, Account_DisplayedAccountState as DisplayedAccountState } from "@scow/protos/build/server/account";
import { ChargeRecord as ChargeRecordProto, PaymentRecord } from "@scow/protos/build/server/charging";
import {
  ExportAccountResponse,
  ExportChargeRecordResponse,
  ExportedUser,
  ExportJobRecordResponse,
  ExportPayRecordResponse,
  ExportServiceClient,
  ExportUserResponse,
} from "@scow/protos/build/server/export";
import {
  GetAllUsersRequest_UsersSortField,
  SortDirection,
  tenantRoleFromJSON,
} from "@scow/protos/build/server/user";
import { createServer } from "src/app";
import { ChargeRecord } from "src/entities/ChargeRecord";
import { JobInfo } from "src/entities/JobInfo";
import { PayRecord } from "src/entities/PayRecord";
import { InitialData, insertInitialData } from "tests/data/data";
import { dropDatabase } from "tests/data/helpers";

let server: Server;
let em: SqlEntityManager;
let data: InitialData;

async function collectData<T, R>(
  stream: AsyncIterable<T>,
  handler: (response: T) => R[],
): Promise<R[]> {
  const collectedData: R[] = [];

  for await (const response of stream) {
    const data = handler(response);
    collectedData.push(...data);
  }

  return collectedData;
}

beforeEach(async () => {

  server = await createServer();

  em = server.ext.orm.em.fork();

  data = await insertInitialData(em);

  await server.start();

});

afterEach(async () => {
  await dropDatabase(server.ext.orm);
  await server.close();
});

const mockOriginalJobData = (
  account: string,
  user: string,
  jobId?: number,
  cluster?: string,
  endTime?: Date,
) => new JobInfo({ cluster: cluster ?? "pkuhpc", ...{
  "jobId": jobId ?? 5119061,
  "account": account,
  "user": user,
  "partition": "C032M0128G",
  "nodeList": "a5u15n01",
  "name": "CoW",
  "state": "COMPLETED",
  "workingDirectory": "",
  "submitTime": "2020-04-23T22:23:00.000Z",
  "startTime": "2020-04-23T22:25:12.000Z",
  "endTime": endTime ? endTime.toISOString() : "2020-04-23T23:18:02.000Z",
  "gpusAlloc": 0,
  "cpusReq": 32,
  "memReqMb": 124000,
  "nodesReq": 1,
  "cpusAlloc": 32,
  "memAllocMb": 124000,
  "nodesAlloc": 1,
  "timeLimitMinutes": 7200,
  "elapsedSeconds": 3170,
  "timeWait": endTime ? 0 : 132,
  "qos": "normal",
  "recordTime": new Date("2020-04-23T23:49:50.000Z"),
  "gpusReq": 0,
} }, data.tenant.name, {
  tenant: { billingItemId: "", price: new Decimal(20) },
  account: { billingItemId: "", price: new Decimal(10) },
});

it("export users", async () => {

  const client = new ExportServiceClient(server.serverAddress, ChannelCredentials.createInsecure());

  const stream = asyncReplyStreamCall(client, "exportUser", {
    count: 1,
    sortField: GetAllUsersRequest_UsersSortField.NAME,
    sortOrder: SortDirection.ASC,
    idOrName: data.userA.name,
    tenantName: data.tenant.name,
    tenantRole: tenantRoleFromJSON(data.userA.tenantRoles[0]),
  });

  const handleUserResponse = (response: ExportUserResponse): ExportedUser[] => {
    return response.users;
  };
  const users = await collectData(stream, handleUserResponse);

  expect(users).toMatchObject([{
    userId: data.userA.userId,
    name: data.userA.name,
    availableAccounts: [data.uaAA.account.getEntity().accountName],
    tenantName: data.tenant.name,
    tenantRoles: [tenantRoleFromJSON(data.userA.tenantRoles[0])],
    email: data.userA.email,
  }]);

});

it("export accounts", async () => {

  const client = new ExportServiceClient(server.serverAddress, ChannelCredentials.createInsecure());


  const stream = asyncReplyStreamCall(client, "exportAccount", {
    count: 3,
    tenantName: data.tenant.name,
  });

  const handleAccountResponse = (response: ExportAccountResponse): Account[] => {
    return response.accounts;
  };

  const accounts = await collectData(stream, handleAccountResponse);

  expect(accounts).toMatchObject([{
    accountName: data.accountA.accountName,
    tenantName: data.tenant.name,
    userCount: 2,
    ownerId: data.userA.userId,
    ownerName: data.userA.name,
    comment: data.accountA.comment,
    blocked: data.accountA.blockedInCluster,
    balance: decimalToMoney(new Decimal(0)),
    displayedState: DisplayedAccountState.DISPLAYED_BELOW_BLOCK_THRESHOLD,
  }, {
    accountName: data.accountB.accountName,
    tenantName: data.tenant.name,
    userCount: 1,
    ownerId: data.userB.userId,
    ownerName: data.userB.name,
    comment: data.accountB.comment,
    blocked: data.accountB.blockedInCluster,
    balance: decimalToMoney(new Decimal(0)),
    displayedState: DisplayedAccountState.DISPLAYED_BELOW_BLOCK_THRESHOLD,
  },
  ]);

});

it("export dept accounts", async () => {

  const client = new ExportServiceClient(server.serverAddress, ChannelCredentials.createInsecure());


  const stream = asyncReplyStreamCall(client, "exportAccount", {
    count: 3,
    tenantName: data.tenant.name,
    accountName: data.accountA.accountName,
    debt: true,
  });

  const handleAccountResponse = (response: ExportAccountResponse): Account[] => {
    return response.accounts;
  };

  const accounts = await collectData(stream, handleAccountResponse);

  expect(accounts).toMatchObject([{
    accountName: data.accountA.accountName,
    tenantName: data.tenant.name,
    userCount: 2,
    ownerId: data.userA.userId,
    ownerName: data.userA.name,
    comment: data.accountA.comment,
    blocked: data.accountA.blockedInCluster,
    balance: decimalToMoney(new Decimal(0)),
    displayedState: DisplayedAccountState.DISPLAYED_BELOW_BLOCK_THRESHOLD,
  },
  ]);

});


it("export charge Records", async () => {

  const amount = new Decimal(10);

  const chargeRecord1 = new ChargeRecord({
    id: 1,
    time: new Date("2023-12-07T07:21:02.000Z"),
    target: data.accountA,
    type: "test",
    comment: "test",
    amount,
    userId: data.userA.userId,
  });

  const chargeRecord2 = new ChargeRecord({
    id: 2,
    time: new Date("2023-12-07T07:21:47.000Z"),
    target: data.accountA,
    type: "testB",
    comment: "test",
    amount,
    userId: data.userA.userId,
  });

  const chargeRecord3 = new ChargeRecord({
    id: 3,
    time: new Date("2023-12-07T07:22:11.000Z"),
    target: data.accountB,
    type: "test",
    comment: "test",
    amount,
  });

  const chargeRecord4 = new ChargeRecord({
    id: 4,
    time: new Date("2023-12-07T07:22:13.000Z"),
    target: data.accountC,
    type: "test",
    comment: "test",
    amount,
  });

  const chargeRecord5 = new ChargeRecord({
    id: 5,
    time: new Date("2023-12-07T07:23:13.000Z"),
    target: data.accountA,
    type: "test",
    comment: "test",
    amount,
    userId: data.userA.userId,
  });

  const chargeRecord6 = new ChargeRecord({
    id: 6,
    time: new Date("2023-12-07T07:24:15.000Z"),
    target: data.accountB,
    type: "test",
    comment: "test",
    amount,
    userId: data.userB.userId,
  });

  await em.persistAndFlush([chargeRecord1, chargeRecord2, chargeRecord3, chargeRecord4, chargeRecord5, chargeRecord6]);

  const client = new ExportServiceClient(server.serverAddress, ChannelCredentials.createInsecure());

  const startTime = new Date("2023-12-07T07:21:02.029Z");
  const queryStartTime = new Date(startTime);
  queryStartTime.setDate(startTime.getDate() - 1);
  const queryEndTime = new Date(startTime);
  queryEndTime.setDate(startTime.getDate() + 1);

  const stream = asyncReplyStreamCall(client, "exportChargeRecord", {
    count: 3,
    startTime: queryStartTime.toISOString(),
    endTime: queryEndTime.toISOString(),
    target:{ $case:"accountOfTenant", accountOfTenant:{ accountName: data.accountA.accountName,
      tenantName: data.accountA.tenant.getProperty("name") } }, types:[chargeRecord1.type],
    userIds: [data.userA.userId],
  });

  const handleChargeResponse = (response: ExportChargeRecordResponse): ChargeRecordProto[] => {
    return response.chargeRecords;
  };
  const records = await collectData(stream, handleChargeResponse);

  expect(records).toHaveLength(2);

  expect(records).toMatchObject([
    {
      index: chargeRecord1.id,
      tenantName: data.accountA.tenant.getProperty("name"),
      accountName: data.accountA.accountName,
      time: chargeRecord1.time.toISOString(),
      amount: decimalToMoney(amount),
      type: "test",
      comment: "test",
      userId: data.userA.userId,
    },
    {
      index: chargeRecord5.id,
      tenantName: data.accountA.tenant.getProperty("name"),
      accountName: data.accountA.accountName,
      time: chargeRecord5.time.toISOString(),
      amount: decimalToMoney(amount),
      type: "test",
      comment: "test",
      userId: data.userA.userId,
    },
  ]);

});



it("export pay Records", async () => {

  const amount = new Decimal(10);

  const payRecord1 = new PayRecord({
    id: 1,
    time: new Date("2023-12-07T07:21:02.000Z"),
    target: data.accountA,
    type: "test",
    comment: "test",
    amount,
    operatorId: "test",
    ipAddress: "127.0.0.1",
  });

  const payRecord2 = new PayRecord({
    id: 2,
    time: new Date("2023-12-07T07:21:47.000Z"),
    target: data.accountA,
    type: "testB",
    comment: "test",
    amount,
    operatorId: "test",
    ipAddress: "127.0.0.1",
  });

  const payRecord3 = new PayRecord({
    id: 3,
    time: new Date("2023-12-07T07:22:11.000Z"),
    target: data.accountB,
    type: "test",
    comment: "test",
    amount,
    operatorId: "test",
    ipAddress: "127.0.0.1",
  });

  const payRecord4 = new PayRecord({
    id: 4,
    time: new Date("2023-12-07T07:22:13.000Z"),
    target: data.accountC,
    type: "test",
    comment: "test",
    amount,
    operatorId: "test",
    ipAddress: "127.0.0.1",
  });

  await em.persistAndFlush([payRecord1, payRecord2, payRecord3, payRecord4]);

  const client = new ExportServiceClient(server.serverAddress, ChannelCredentials.createInsecure());

  const startTime = new Date("2023-12-07T07:21:02.000Z");
  const queryStartTime = new Date(startTime);
  queryStartTime.setDate(startTime.getDate() - 1);
  const queryEndTime = new Date(startTime);
  queryEndTime.setDate(startTime.getDate() + 1);

  const stream = asyncReplyStreamCall(client, "exportPayRecord", {
    count: 2,
    startTime: queryStartTime.toISOString(),
    endTime: queryEndTime.toISOString(),
    target:{ $case:"accountsOfTenant", accountsOfTenant:{
      accountNames: [data.accountA.accountName, data.accountB.accountName],
      tenantName: data.accountA.tenant.getProperty("name"),
    } }, types:[payRecord1.type],
  });
  const handlePaymentResponse = (response: ExportPayRecordResponse): PaymentRecord[] => {
    return response.payRecords;
  };
  const records = await collectData(stream, handlePaymentResponse);

  expect(records).toHaveLength(2);

  expect(records).toMatchObject([
    {
      index: payRecord1.id,
      tenantName: data.accountA.tenant.getProperty("name"),
      accountName: data.accountA.accountName,
      time: payRecord1.time.toISOString(),
      amount: decimalToMoney(amount),
      type: "test",
      comment: "test",
      operatorId: payRecord1.operatorId,
      ipAddress: payRecord1.ipAddress,
    },
    {
      index: payRecord3.id,
      tenantName: data.accountB.tenant.getProperty("name"),
      accountName: data.accountB.accountName,
      time: payRecord3.time.toISOString(),
      amount: decimalToMoney(amount),
      type: "test",
      comment: "test",
      operatorId: payRecord3.operatorId,
      ipAddress: payRecord3.ipAddress,
    },
  ]);

});

it("export job Records", async () => {

  const accountA = data.accountA.accountName,
    accountB = data.accountB.accountName;

  const userA = data.userA.userId,
    userB = data.userB.userId;


  const jobs = [
    mockOriginalJobData(accountA, userA),
    mockOriginalJobData(accountB, userA),
    mockOriginalJobData(accountB, userB),
    mockOriginalJobData(accountA, userB),
    mockOriginalJobData(accountA, userA, 89757),
    mockOriginalJobData(accountA, userA, 5119061, "cuchpc"),
    mockOriginalJobData(accountA, userA, 5119061, "pkuhpc", new Date("2020-04-24T00:00:00.000Z")),
  ];

  await em.persistAndFlush(jobs);

  const client = new ExportServiceClient(server.serverAddress, ChannelCredentials.createInsecure());

  const baseQueryTime = new Date("2020-04-23T23:21:02.000Z");
  const jobEndTimeStart = new Date(baseQueryTime);
  jobEndTimeStart.setDate(baseQueryTime.getDate() - 1);
  const jobEndTimeEnd = new Date(baseQueryTime);
  jobEndTimeEnd.setDate(baseQueryTime.getDate());

  const stream = asyncReplyStreamCall(client, "exportJobRecord", {
    count: 3,
    jobEndTimeStart: jobEndTimeStart.toISOString(),
    jobEndTimeEnd: jobEndTimeEnd.toISOString(),
    target:{ $case: "jobsOfAccountAndUser",
      jobsOfAccountAndUser: { accountName: accountA, userId: userA,
        tenantName: data.accountA.tenant.getProperty("name") },
    }, clusters:["pkuhpc"],
  });

  const handlePaymentResponse = (response: ExportJobRecordResponse): JobInfoProto[] => {
    return response.jobRecords;
  };
  const records = await collectData(stream, handlePaymentResponse);

  expect(records).toHaveLength(2);

  const expectObject = [
    {
      idJob: 5119061,
      account: accountA,
      user: userA,
      cluster: "pkuhpc",
      timeEnd: "2020-04-23T23:18:02.000Z",
    },
    {
      idJob: 89757,
      account: accountA,
      user: userA,
      timeEnd: "2020-04-23T23:18:02.000Z",
      cluster: "pkuhpc",
    },
  ];

  expect(records).toMatchObject(expectObject);

  const stream2 = asyncReplyStreamCall(client, "exportJobRecord", {
    count: 4,
    jobEndTimeStart: jobEndTimeStart.toISOString(),
    jobEndTimeEnd: jobEndTimeEnd.toISOString(),
    target:{ $case: "jobsOfUser",
      jobsOfUser: { userId: userA,
        tenantName: data.accountA.tenant.getProperty("name") },
    }, clusters:["pkuhpc","cuchpc"],
  });

  const records2 = await collectData(stream2, handlePaymentResponse);

  expect(records2).toHaveLength(4);

  expect(records2).toMatchObject([
    expectObject[0],
    {
      idJob: 5119061,
      account: accountB,
      user: userA,
      cluster: "pkuhpc",
      timeEnd: "2020-04-23T23:18:02.000Z",
    },
    expectObject[1],
    {
      idJob: 5119061,
      account: accountA,
      user: userA,
      cluster: "cuchpc",
      timeEnd: "2020-04-23T23:18:02.000Z",
    },
  ]);

  const stream3 = asyncReplyStreamCall(client, "exportJobRecord", {
    count: 1,
    jobEndTimeStart: jobEndTimeStart.toISOString(),
    jobEndTimeEnd: jobEndTimeEnd.toISOString(),
    target:{ $case: "jobsOfJobId",
      jobsOfJobId: { jobId: 5119061,
        tenantName: data.accountA.tenant.getProperty("name") },
    }, clusters:["cuchpc"],
  });

  const records3 = await collectData(stream3, handlePaymentResponse);

  expect(records3).toHaveLength(1);

  expect(records3).toMatchObject([{
    idJob: 5119061,
    account: accountA,
    user: userA,
    cluster: "cuchpc",
    timeEnd: "2020-04-23T23:18:02.000Z",
  }]);
});

