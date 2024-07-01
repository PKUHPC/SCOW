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
import { GetOperationLogsRequest_SortBy as SortBy } from "@scow/protos/build/audit/operation_log";
import { SortOrder } from "@scow/protos/build/common/sort_order";
import { UserServiceClient } from "@scow/protos/build/server/user";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { OperationLog, OperationLogQueryType,
  OperationResult, OperationSortBy, OperationSortOrder } from "src/models/operationLog";
import { PlatformRole, TenantRole, UserRole } from "src/models/User";
import { getClient } from "src/utils/client";
import { runtimeConfig } from "src/utils/config";

export const mapOperationSortByType = {
  "id":SortBy.ID,
  "operationResult":SortBy.OPERATION_RESULT,
  "operationTime":SortBy.OPERATION_TIME,
  "operatorIp":SortBy.OPERATOR_IP,
  "operatorUserId":SortBy.OPERATOR_USER_ID,
} as { [key: string]: SortBy};

export const mapOperationSortOrderType = {
  "descend":SortOrder.DESCEND,
  "ascend":SortOrder.ASCEND,
} as { [key: string]: SortOrder };

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


export const GetOperationLogsSchema = typeboxRouteSchema({

  method: "GET",

  query: Type.Object({

    type: Type.Enum(OperationLogQueryType),

    ...GetOperationLogFilter.properties,

    page: Type.Integer({ minimum: 1 }),

    pageSize: Type.Optional(Type.Integer()),

    sortBy: Type.Optional(OperationSortBy),

    sortOrder: Type.Optional(OperationSortOrder),
  }),

  responses: {
    200: Type.Object({
      results: Type.Array(OperationLog),
      totalCount: Type.Number(),
    }),


    403: Type.Null(),
  },
});

export default typeboxRoute(GetOperationLogsSchema, async (req, res) => {
  const auth = authenticate(() => true);

  const info = await auth(req, res);

  if (!info) { return; }

  const {
    type, operatorUserIds, startTime, endTime,
    operationType, operationResult, operationDetail,
    operationTargetAccountName, customEventType, page, pageSize, sortBy, sortOrder } = req.query;

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
      return { 400: null };
    }

    // 确认用户是账户管理员或者拥有者
    if (
      !info.accountAffiliations
        .find((au) => au.accountName === filter.operationTargetAccountName
      && (au.role === UserRole.ADMIN || au.role === UserRole.OWNER))
    ) {
      return { 403: null };
    }
  };

  if (type === OperationLogQueryType.TENANT) {
    if (!info.tenantRoles.includes(TenantRole.TENANT_ADMIN)) {
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
      return { 403: null };
    }
  }
  const mapOperationSortBy = sortBy ? mapOperationSortByType[sortBy] : undefined;
  const mapOperationSortOrder = sortOrder ? mapOperationSortOrderType[sortOrder] : undefined;

  const client = getClient(UserServiceClient);

  const { getLog } = createOperationLogClient(runtimeConfig.AUDIT_CONFIG, console);
  const resp = await getLog({
    filter,
    page,
    pageSize,
    sortBy:mapOperationSortBy,
    sortOrder:mapOperationSortOrder,
  });



  const { results, totalCount } = resp;

  const userIds = Array.from(new Set(results.map((x) => x.operatorUserId)));


  const { users } = await asyncClientCall(client, "getUsersByIds", {
    userIds,
  });

  const userMap = new Map(users.map((x) => [x.userId, x.userName]));



  const operationLogs = results.map((x) => {
    return {
      operationLogId: x.operationLogId,
      operatorUserId: x.operatorUserId,
      operatorUserName: userMap.get(x.operatorUserId) || "",
      operatorIp: x.operatorIp,
      operationResult: x.operationResult,
      operationTime: x.operationTime,
      operationEvent: x.operationEvent,
    };
  });

  return {
    200: { results: operationLogs as any as OperationLog[], totalCount },
  };
});
