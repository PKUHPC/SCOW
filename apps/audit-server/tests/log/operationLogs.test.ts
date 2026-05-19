import { asyncClientCall, asyncReplyStreamCall } from "@ddadaal/tsgrpc-client";
import { Server } from "@ddadaal/tsgrpc-server";
import { ChannelCredentials } from "@grpc/grpc-js";
import {
  ExportOperationLogResponse,
  OperationLog as OperationLogProto,
  OperationLogServiceClient,
  OperationResult as OperationResultProto,
  operationResultFromJSON,
} from "@scow/protos/build/audit/operation_log";
import { createServer } from "src/app";
import { OperationLog, OperationResult } from "src/entities/OperationLog";
import { dropDatabase } from "tests/utils/helpers";

let server: Server;
let client: OperationLogServiceClient;

const operationLog = {
  operatorUserId: "testUserId",
  operatorIp: "127.0.0.1",
  operationResult: OperationResult.SUCCESS,
  operationEvent: {
    $case: "submitJob" as const,
    submitJob: {
      accountName: "testAccount",
      jobId: 123,
      clusterId: "test",
    },
  },
};

const operationLog1 = new OperationLog({
  operationLogId: 1,
  operatorUserId: operationLog.operatorUserId,
  operatorIp: operationLog.operatorIp,
  operationResult: operationLog.operationResult,
  operationTime: new Date("2023-08-14T10:45:02.000Z"),
  metaData: operationLog.operationEvent,
});

const operationLog2 = new OperationLog({
  operationLogId: 2,
  operatorUserId: operationLog.operatorUserId,
  operatorIp: operationLog.operatorIp,
  operationResult: operationLog.operationResult,
  operationTime: new Date("2023-08-14T10:45:02.000Z"),
  metaData: {
    $case: "endJob",
    endJob: {
      jobId: 123,
      clusterId: "test",
    },
  },
});

const operationLog3 = new OperationLog({
  operationLogId: 3,
  operatorUserId: operationLog.operatorUserId,
  operatorIp: operationLog.operatorIp,
  operationResult: operationLog.operationResult,
  operationTime: new Date("2023-12-05T02:14:54.165Z"),
  metaData: {
    $case: "exportOperationLog",
    exportOperationLog: {
      source: { $case: "account", account: { accountName: "test_account" } },
    },
    targetAccountName: "test_account",
  },
});

const operationLog4 = new OperationLog({
  operationLogId: 4,
  operatorUserId: operationLog.operatorUserId,
  operatorIp: operationLog.operatorIp,
  operationResult: operationLog.operationResult,
  operationTime: new Date("2023-12-05T02:15:02.648Z"),
  metaData: {
    $case: "exportOperationLog",
    exportOperationLog: {
      source: { $case: "admin", admin: {} },
    },
  },
});

// custom event
const operationLog5 = new OperationLog({
  operationLogId: 5,
  operatorUserId: operationLog.operatorUserId,
  operatorIp: operationLog.operatorIp,
  operationResult: operationLog.operationResult,
  operationTime: new Date("2023-12-05T02:15:02.648Z"),
  customEventType: "test",
  metaData: {
    $case: "customEvent",
    customEvent: {
      type: "test",
      name: {
        i18n: {
          default: "test",
          en: "test",
          zhCn: "测试",
        },
      },
      content: {
        i18n: {
          default: "test content",
          en: "test content",
          zhCn: "测试内容",
        },
      },
    },
  },
});

async function collectOperationLog(stream: AsyncIterable<ExportOperationLogResponse>) {
  const operationLogs: OperationLogProto[] = [];

  for await (const res of stream) {
    const a = res.operationLogs;
    a.forEach((o) => {
      operationLogs.push(o);
    });
  }

  return operationLogs;
}

beforeEach(async () => {
  server = await createServer();
  await server.start();
  client = new OperationLogServiceClient(server.serverAddress, ChannelCredentials.createInsecure());
});

afterEach(async () => {
  await dropDatabase(server.ext.orm);
  await server.close();
});

it("create operation log", async () => {
  const em = server.ext.orm.em.fork();

  await asyncClientCall(client, "createOperationLog", {
    ...operationLog,
    operationResult: operationResultFromJSON(operationLog.operationResult),
  });

  const operationLogs = await em.find(
    OperationLog,
    { operatorUserId: operationLog.operatorUserId },
    {
      orderBy: { operationTime: "DESC" },
      limit: 1,
    },
  );

  expect(operationLogs[0].operatorUserId).toEqual(operationLog.operatorUserId);
  expect(operationLogs[0].operatorIp).toEqual(operationLog.operatorIp);
  expect(operationLogs[0].operationResult).toEqual(operationLog.operationResult);
  expect(operationLogs[0].metaData?.$case).toEqual(operationLog.operationEvent.$case);
  expect(operationLogs[0].metaData?.[operationLogs[0].metaData?.$case]).toEqual(operationLog.operationEvent.submitJob);
  expect(operationLogs[0].metaData?.targetAccountName).toEqual(operationLog.operationEvent.submitJob.accountName);
});

it("create operation log with targetAccountName", async () => {
  const em = server.ext.orm.em.fork();

  const exportChargeRecordLog = {
    operatorUserId: "testUserId",
    operatorIp: "127.0.0.1",
    operationResult: operationResultFromJSON(OperationResult.SUCCESS),
    operationEvent: {
      $case: "exportChargeRecord" as const,
      exportChargeRecord: {
        target: {
          $case: "accountOfTenant" as const,
          accountOfTenant: {
            accountName: "testAccount",
            tenantName: "testTenant",
          },
        },
      },
    },
  };

  const exportPayRecordLog = {
    operatorUserId: "testUserId",
    operatorIp: "127.0.0.1",
    operationResult: operationResultFromJSON(OperationResult.SUCCESS),
    operationEvent: {
      $case: "exportPayRecord" as const,
      exportPayRecord: {
        target: {
          $case: "accountsOfTenant" as const,
          accountsOfTenant: {
            tenantName: "testTenant",
            accountNames: [],
          },
        },
      },
    },
  };

  const exportOperationLog = {
    operatorUserId: "testUserId",
    operatorIp: "127.0.0.1",
    operationResult: operationResultFromJSON(OperationResult.SUCCESS),
    operationEvent: {
      $case: "exportOperationLog" as const,
      exportOperationLog: {
        source: {
          $case: "account" as const,
          account: {
            accountName: "testAccount",
          },
        },
      },
    },
  };
  await asyncClientCall(client, "createOperationLog", {
    ...exportChargeRecordLog,
  });
  await asyncClientCall(client, "createOperationLog", {
    ...exportPayRecordLog,
  });
  await asyncClientCall(client, "createOperationLog", {
    ...exportOperationLog,
  });

  const operationLogs = await em.find(
    OperationLog,
    { operatorUserId: operationLog.operatorUserId },
    {
      orderBy: { operationTime: "DESC" },
      limit: 3,
    },
  );

  expect(operationLogs[0].metaData?.$case).toEqual("exportOperationLog");
  expect(operationLogs[0].metaData?.[operationLogs[0].metaData?.$case]).toEqual(
    exportOperationLog.operationEvent.exportOperationLog,
  );
  expect(operationLogs[0].metaData?.targetAccountName).toEqual(
    exportOperationLog.operationEvent.exportOperationLog.source.account.accountName,
  );

  expect(operationLogs[1].metaData?.$case).toEqual("exportPayRecord");
  expect(operationLogs[1].metaData?.[operationLogs[1].metaData?.$case]).toEqual(
    exportPayRecordLog.operationEvent.exportPayRecord,
  );
  expect(operationLogs[1].metaData?.targetAccountName).toEqual(
    exportPayRecordLog.operationEvent.exportPayRecord.target.accountsOfTenant.accountNames,
  );

  expect(operationLogs[2].metaData?.$case).toEqual("exportChargeRecord");
  expect(operationLogs[2].metaData?.[operationLogs[2].metaData?.$case]).toEqual(
    exportChargeRecordLog.operationEvent.exportChargeRecord,
  );
  expect(operationLogs[2].metaData?.targetAccountName).toEqual(
    exportChargeRecordLog.operationEvent.exportChargeRecord.target.accountOfTenant.accountName,
  );
});

it("create operation log for custom event", async () => {
  const em = server.ext.orm.em.fork();

  const createCustomOperationLog = {
    operatorUserId: operationLog.operatorUserId,
    operatorIp: operationLog.operatorIp,
    operationResult: OperationResultProto.SUCCESS,
    operationEvent: {
      $case: "customEvent" as const,
      customEvent: {
        type: "test",
        name: {
          i18n: {
            default: "test",
            en: "test",
            zhCn: "测试",
          },
        },
        content: {
          i18n: {
            default: "test content",
            en: "test content",
            zhCn: "测试内容",
          },
        },
      },
    },
  };

  await asyncClientCall(client, "createOperationLog", createCustomOperationLog);

  const operationLogs = await em.find(
    OperationLog,
    { operatorUserId: operationLog.operatorUserId },
    {
      orderBy: { operationTime: "DESC" },
      limit: 1,
    },
  );

  expect(operationLogs[0].operatorUserId).toEqual(operationLog.operatorUserId);
  expect(operationLogs[0].operatorIp).toEqual(operationLog.operatorIp);
  expect(operationLogs[0].operationResult).toEqual(operationLog.operationResult);
  expect(operationLogs[0].metaData?.$case).toEqual("customEvent");
  expect(operationLogs[0].metaData?.[operationLogs[0].metaData?.$case]).toEqual(
    createCustomOperationLog?.operationEvent?.customEvent,
  );
});

it("get operation logs", async () => {
  const em = server.ext.orm.em.fork();
  await em.persistAndFlush([operationLog1, operationLog2]);

  const resp = await asyncClientCall(client, "getOperationLogs", {
    page: 1,
    filter: { operatorUserIds: ["testUserId"], operationDetail: "123" },
  });

  expect(resp.totalCount).toBe(2);

  expect(resp.results).toIncludeSameMembers([
    {
      operationLogId: 1,
      operatorUserId: operationLog.operatorUserId,
      operatorIp: operationLog.operatorIp,
      operationResult: operationResultFromJSON(operationLog.operationResult),
      operationTime: "2023-08-14T10:45:02.000Z",
      operationEvent: operationLog.operationEvent,
    },
    {
      operationLogId: 2,
      operatorUserId: operationLog.operatorUserId,
      operatorIp: operationLog.operatorIp,
      operationResult: operationResultFromJSON(operationLog.operationResult),
      operationTime: "2023-08-14T10:45:02.000Z",
      operationEvent: {
        $case: "endJob",
        endJob: {
          jobId: 123,
          clusterId: "test",
        },
      },
    },
  ]);
});

it("get logs for custom event", async () => {
  const em = server.ext.orm.em.fork();
  await em.persistAndFlush([operationLog5]);

  const resp = await asyncClientCall(client, "getOperationLogs", {
    page: 1,
    filter: { operatorUserIds: ["testUserId"] },
  });

  expect(resp.totalCount).toBe(1);

  expect(resp.results).toIncludeSameMembers([
    {
      operationLogId: 5,
      operatorUserId: operationLog.operatorUserId,
      operatorIp: operationLog.operatorIp,
      operationResult: operationResultFromJSON(operationLog.operationResult),
      operationTime: operationLog5.operationTime?.toISOString(),
      operationEvent: {
        $case: "customEvent",
        customEvent: {
          type: "test",
          name: {
            i18n: {
              default: "test",
              en: "test",
              zhCn: "测试",
            },
          },
          content: {
            i18n: {
              default: "test content",
              en: "test content",
              zhCn: "测试内容",
            },
          },
        },
      },
    },
  ]);
});

it("export operation logs", async () => {
  const em = server.ext.orm.em.fork();
  await em.persistAndFlush([operationLog3, operationLog4]);

  const stream = asyncReplyStreamCall(client, "exportOperationLog", {
    count: 2,
    filter: { operatorUserIds: ["testUserId"] },
  });

  const exportOperationLogs = await collectOperationLog(stream);

  expect(exportOperationLogs).toMatchObject([
    {
      operationLogId: 4,
      operatorUserId: operationLog4.operatorUserId,
      operatorIp: operationLog4.operatorIp,
      operationResult: operationResultFromJSON(operationLog4.operationResult),
      operationTime: operationLog4.operationTime?.toISOString(),
      operationEvent: operationLog4.metaData,
    },
    {
      operationLogId: 3,
      operatorUserId: operationLog3.operatorUserId,
      operatorIp: operationLog3.operatorIp,
      operationResult: operationResultFromJSON(operationLog3.operationResult),
      operationTime: operationLog3.operationTime?.toISOString(),
      operationEvent: {
        $case: "exportOperationLog",
        exportOperationLog: {
          source: { $case: "account", account: { accountName: "test_account" } },
        },
      },
    },
  ]);
});

it("create operation log for jobRecord", async () => {
  const em = server.ext.orm.em.fork();

  const exportJobRecordLog = {
    operatorUserId: "testUserId",
    operatorIp: "127.0.0.1",
    operationResult: operationResultFromJSON(OperationResult.SUCCESS),
    operationEvent: {
      $case: "exportJobRecord" as const,
      exportJobRecord: {
        target: {
          $case: "jobsOfAccount" as const,
          jobsOfAccount: {
            tenantName: "testTenant",
            accountName: "testAccount",
          },
        },
      },
    },
  };

  await asyncClientCall(client, "createOperationLog", {
    ...exportJobRecordLog,
  });

  const operationLogs = await em.find(
    OperationLog,
    { operatorUserId: operationLog.operatorUserId },
    {
      orderBy: { operationTime: "DESC" },
      limit: 1,
    },
  );

  expect(operationLogs[0].metaData?.$case).toEqual("exportJobRecord");
  expect(operationLogs[0].metaData?.[operationLogs[0].metaData?.$case]).toEqual(
    exportJobRecordLog.operationEvent.exportJobRecord,
  );
  expect(
    operationLogs[0].metaData?.[operationLogs[0].metaData?.$case].target?.[
      exportJobRecordLog.operationEvent.exportJobRecord.target.$case
    ].accountName,
  ).toEqual(exportJobRecordLog.operationEvent.exportJobRecord.target.jobsOfAccount.accountName);
});
