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

import { typeboxRoute, typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { createOperationLogClient, OperationType } from "@scow/lib-operation-log";
import { getCurrentLanguageId } from "@scow/lib-web/build/utils/systemLanguage";
import { ExportOperationLog, OperationLog } from "@scow/protos/build/audit/operation_log";
import { UserServiceClient } from "@scow/protos/build/server/user";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { getI18nCurrentText, getT, getTArgs, prefix } from "src/i18n";
import { Encoding } from "src/models/exportFile";
import { getOperationDetail, getOperationResultTexts, getOperationTypeTexts, OperationCodeMap, OperationLogQueryType,
  OperationResult } from "src/models/operationLog";
import { PlatformRole, TenantRole, UserInfo, UserRole } from "src/models/User";
import { MAX_EXPORT_COUNT } from "src/pageComponents/file/apis";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { publicConfig, runtimeConfig } from "src/utils/config";
import { createEncodingTransform, getContentTypeWithCharset, getCsvObjTransform,
  getCsvStringify } from "src/utils/file";
import { parseIp } from "src/utils/server";
import { pipeline } from "stream";


export const GetOperationLogFilter = Type.Object({

  operatorUserIds: Type.String(),

  startTime: Type.Optional(Type.String({ format: "date-time" })),

  endTime: Type.Optional(Type.String({ format: "date-time" })),

  operationType: Type.Optional(Type.Enum(OperationType)),
  operationResult: Type.Optional(Type.Enum(OperationResult)),
  operationDetail: Type.Optional(Type.String()),
  operationTargetAccountName: Type.Optional(Type.String()),
  customEventType: Type.Optional(Type.String()),
});

export type GetOperationLogFilter = Static<typeof GetOperationLogFilter>;


export const ExportOperationLogSchema = typeboxRouteSchema({

  method: "GET",

  query: Type.Object({

    type: Type.Enum(OperationLogQueryType),

    ...GetOperationLogFilter.properties,

    columns: Type.Array(Type.String()),

    count: Type.Number(),

    encoding: Type.Enum(Encoding),
  }),

  responses: {
    200: Type.Any(),

    403: Type.Null(),

    409: Type.Object({ code: Type.Literal("TOO_MANY_DATA") }),
  },
});

const getExportSource = (
  type: OperationLogQueryType,
  info: UserInfo,
  accountName: string | undefined): ExportOperationLog["source"] => {

  switch (type) {
  case OperationLogQueryType.USER:
    return {
      $case: "user",
      user: {
        userId: info.identityId,
      },
    };
  case OperationLogQueryType.ACCOUNT:
    return accountName
      ? {
        $case: "account",
        account: {
          accountName,
        },
      }
      : undefined;
  case OperationLogQueryType.TENANT:
    return {
      $case: "tenant",
      tenant: {
        tenantName: info.tenant,
      },
    };
  default:
    return {
      $case: "admin",
      admin: {},
    };
  }
};

export default typeboxRoute(ExportOperationLogSchema, async (req, res) => {
  const auth = authenticate(() => true);



  const info = await auth(req, res);

  if (!info) { return; }

  const {
    count, columns, type, operatorUserIds, startTime, endTime, operationType,
    operationResult, operationDetail, operationTargetAccountName, customEventType, encoding } = req.query;


  const logSource = getExportSource(type, info, operationTargetAccountName);

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.exportOperationLog,
    operationTypePayload:{
      source: logSource,
    },
  };

  if (count > MAX_EXPORT_COUNT) {
    await callLog(logInfo, OperationResult.FAIL);
    return { 409: { code: "TOO_MANY_DATA" } } as const;
  } else {
    const filter = {
      operatorUserIds: operatorUserIds ? operatorUserIds.split(",") : [],
      startTime, endTime, operationType,
      operationResult, operationTargetAccountName,
      operationDetail,
      customEventType,
    };
    // 用户请求
    if (type === OperationLogQueryType.USER) {
      filter.operatorUserIds = [info.identityId];
    }

    if (type === OperationLogQueryType.ACCOUNT) {
      if (!filter.operationTargetAccountName) {
        await callLog(logInfo, OperationResult.FAIL);
        return { 400: null };
      }

      // 确认用户是账户管理员或者拥有者
      if (
        !info.accountAffiliations
          .find((au) => au.accountName === filter.operationTargetAccountName
      && (au.role === UserRole.ADMIN || au.role === UserRole.OWNER))
      ) {
        await callLog(logInfo, OperationResult.FAIL);
        return { 403: null };
      }
    };

    if (type === OperationLogQueryType.TENANT) {
      if (!info.tenantRoles.includes(TenantRole.TENANT_ADMIN)) {
        await callLog(logInfo, OperationResult.FAIL);
        return { 403: null };
      }
      // 查看该租户下所有用户的操作日志
      const client = getClient(UserServiceClient);
      const { users } = await asyncClientCall(client, "getUsers", {
        tenantName: info.tenant,
      });

      // 搜索条件中的userId必须是属于该tenant的
      filter.operatorUserIds = filter.operatorUserIds.length === 0
        ? users.map((u) => u.userId)
        : filter.operatorUserIds.filter((id) => users.find((u) => u.userId === id));
    };

    if (type === OperationLogQueryType.PLATFORM) {
      if (!info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN)) {
        await callLog(logInfo, OperationResult.FAIL);
        return { 403: null };
      }
    }
    const { exportLog } = createOperationLogClient(runtimeConfig.AUDIT_CONFIG, console);

    const filename = `operation_log-${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}.csv`;
    const dispositionParm = "filename* = UTF-8''" + encodeURIComponent(filename);

    const contentTypeWithCharset = getContentTypeWithCharset(filename, encoding);

    res.writeHead(200, {
      "Content-Type":contentTypeWithCharset,
      "Content-Disposition": `attachment; ${dispositionParm}`,
    });


    const stream = await exportLog({ filter, count });

    const languageId = getCurrentLanguageId(req, publicConfig.SYSTEM_LANGUAGE_CONFIG);
    const t = await getT(languageId);
    const tArgs = await getTArgs(languageId);
    const p = prefix("component.others.");
    const OperationTypeTexts = getOperationTypeTexts(t);
    const OperationResultTexts = getOperationResultTexts(t);


    const formatOperationLog = (x: OperationLog) => {
      return {
        id: x.operationLogId,
        operationCode: x.operationEvent?.["$case"] ? OperationCodeMap[x.operationEvent?.["$case"]] : "000000",
        operationType: x.operationEvent?.["$case"] === "customEvent"
          ? getI18nCurrentText(x.operationEvent.customEvent.name, languageId)
          : OperationTypeTexts[x.operationEvent?.["$case"] || "unknown"],
        operationDetail: x.operationEvent ?
          x.operationEvent?.["$case"] === "customEvent"
            ? getI18nCurrentText(x.operationEvent.customEvent.content, languageId)
            : getOperationDetail(x.operationEvent, t, tArgs, languageId)
          : "",
        operationResult: OperationResultTexts[x.operationResult],
        operatorUserId: x.operatorUserId,
        operationTime: x.operationTime ? new Date(x.operationTime).toISOString() : "",
        operatorIp: x.operatorIp,
      };
    };

    const headerColumns = {
      id: "Operation Log ID",
      operationCode: t(p("operationCode")),
      operationType: t(p("operationType")),
      operationDetail: t(p("operationDetail")),
      operationResult: t(p("operationResult")),
      operationTime: t(p("operationTime")),
      operatorUserId: t(p("operatorUserId")),
      operatorIp: t(p("operatorIp")),
    };

    const csvStringify = getCsvStringify(headerColumns, columns);

    const transform = getCsvObjTransform("operationLogs", formatOperationLog);
    const encodingTransform = createEncodingTransform(encoding); // 创建编码转换流

    pipeline(
      stream,
      transform,
      csvStringify,
      encodingTransform, // 添加编码转换流到管道
      res,
      async (err) => {
        if (err) {
          console.error("Pipeline failed", err);
          await callLog(logInfo, OperationResult.FAIL);
        } else {
          await callLog(logInfo, OperationResult.SUCCESS);
        }
      },
    );
  }
});
