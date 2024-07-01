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

import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncReplyStreamCall } from "@ddadaal/tsgrpc-client";
import { OperationType } from "@scow/lib-operation-log";
import { getCurrentLanguageId } from "@scow/lib-web/build/utils/systemLanguage";
import { ExportedUser, ExportServiceClient } from "@scow/protos/build/server/export";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { getT, prefix } from "src/i18n";
import { Encoding } from "src/models/exportFile";
import { OperationResult } from "src/models/operationLog";
import {
  PlatformRole,
  SortDirectionType,
  TenantRole,
  UsersSortFieldType } from "src/models/User";
import { MAX_EXPORT_COUNT } from "src/pageComponents/file/apis";
import { mapSortDirectionType, mapUsersSortFieldType } from "src/pages/api/admin/getAllUsers";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { publicConfig } from "src/utils/config";
import { createEncodingTransform, getContentTypeWithCharset, getCsvObjTransform,
  getCsvStringify } from "src/utils/file";
import { route } from "src/utils/route";
import { parseIp } from "src/utils/server";
import { pipeline } from "stream";

export const ExportUserSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({

    columns: Type.Array(Type.String()),

    count: Type.Number(),

    sortField: Type.Optional(UsersSortFieldType),

    sortOrder: Type.Optional(SortDirectionType),

    idOrName: Type.Optional(Type.String()),

    platformRole: Type.Optional(Type.Enum(PlatformRole)),

    tenantRole: Type.Optional(Type.Enum(TenantRole)),

    // true表示只导出自己租户的用户
    selfTenant: Type.Optional(Type.Boolean()),
    encoding: Type.Enum(Encoding),
  }),

  responses:{
    200: Type.Any(),

    409: Type.Object({ code: Type.Literal("TOO_MANY_DATA") }),
  },
});

const auth = authenticate((info) => info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN));

export default route(ExportUserSchema, async (req, res) => {
  const { query } = req;

  const { columns, sortField, sortOrder, idOrName, platformRole, tenantRole, selfTenant, count, encoding } = query;

  const info = await auth(req, res);
  if (!info) {
    return;
  }

  const mappedSortField = sortField ? mapUsersSortFieldType[sortField] : undefined;
  const mappedSortOrder = sortOrder ? mapSortDirectionType[sortOrder] : undefined;

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.exportAccount,
    operationTypePayload:{
      tenantName: selfTenant ? info.tenant : undefined,
    },
  };

  if (count > MAX_EXPORT_COUNT) {
    await callLog(logInfo, OperationResult.FAIL);
    return { 409: { code: "TOO_MANY_DATA" } } as const;

  } else {
    const client = getClient(ExportServiceClient);

    const filename = `account-${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}.csv`;
    const dispositionParm = "filename* = UTF-8''" + encodeURIComponent(filename);

    const contentTypeWithCharset = getContentTypeWithCharset(filename, encoding);

    res.writeHead(200, {
      "Content-Type":contentTypeWithCharset,
      "Content-Disposition": `attachment; ${dispositionParm}`,
    });

    const stream = asyncReplyStreamCall(client, "exportUser", {
      count,
      sortField: mappedSortField,
      sortOrder: mappedSortOrder,
      idOrName,
      tenantName: selfTenant ? info.tenant : undefined,
      tenantRole,
      platformRole,
    });

    const languageId = getCurrentLanguageId(req, publicConfig.SYSTEM_LANGUAGE_CONFIG);
    const t = await getT(languageId);
    const pAdmin = prefix("pageComp.admin.allUserTable.");
    const pTenant = prefix("pageComp.tenant.adminUserTable.");
    const pCommon = prefix("common.");

    const headerColumns = {
      userId: t(pAdmin("userId")),
      name: t(pAdmin("name")),
      email: t(pCommon("email")),
      tenantName:  t(pAdmin("tenant")),
      availableAccounts: t(pAdmin("availableAccounts")),
      createTime: t(pCommon("createTime")),
      tenantRoles: t(pTenant("tenantRole")),
      platformRoles: t(pAdmin("roles")),
    };

    const TenantRoleI18nTexts = {
      [TenantRole.TENANT_FINANCE]: t("userRoles.tenantFinance"),
      [TenantRole.TENANT_ADMIN]: t("userRoles.tenantAdmin"),
    };
    const PlatformRoleI18nTexts = {
      [PlatformRole.PLATFORM_FINANCE]: t("userRoles.platformFinance"),
      [PlatformRole.PLATFORM_ADMIN]: t("userRoles.platformAdmin"),
    };


    const formatUser = (x: ExportedUser) => {
      return {
        userId: x.userId,
        name: x.name,
        email: x.email,
        tenantName: x.tenantName,
        availableAccounts: x.availableAccounts.join(","),
        createTime: x.createTime ? new Date(x.createTime).toISOString() : "",
        tenantRoles: x.tenantRoles.map((x) => TenantRoleI18nTexts[x]).join(","),
        platformRoles: x.platformRoles.map((x) => PlatformRoleI18nTexts[x]).join(","),
      };
    };

    const csvStringify = getCsvStringify(headerColumns, columns);

    const transform = getCsvObjTransform("users", formatUser);
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
