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
import { BillListItem } from "@scow/protos/build/server/bill";
import { ExportServiceClient } from "@scow/protos/build/server/export";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { getT, prefix } from "src/i18n";
import { BillType } from "src/models/bill";
import { Encoding } from "src/models/exportFile";
import { OperationResult } from "src/models/operationLog";
import { PlatformRole, TenantRole, UserRole } from "src/models/User";
import { SearchType } from "src/pageComponents/common/BillTable";
import { MAX_EXPORT_COUNT } from "src/pageComponents/file/apis";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { publicConfig } from "src/utils/config";
import { createEncodingTransform, getBillCsvStringify, getContentTypeWithCharset,
  getCsvObjTransform } from "src/utils/file";
import { nullableMoneyToString } from "src/utils/money";
import { route } from "src/utils/route";
import { parseIp } from "src/utils/server";
import { pipeline } from "stream";

export const ExportBillSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    columns: Type.Array(Type.String()),
    count: Type.Number(),

    accountNames: Type.Optional(Type.Array(Type.String())),
    type: Type.Enum(BillType),
    userIdsOrNames: Type.Optional(Type.String()), // 支持多个用户ID或名字，使用逗号分隔
    termStart: Type.Optional(Type.String()), // 账期开始，格式如 "202407"
    termEnd: Type.Optional(Type.String()), // 账期结束，格式如 "202407"
    searchType: Type.Optional(Type.Enum(SearchType)),

    types:Type.Optional(Type.Array(Type.String())),
    encoding: Type.Enum(Encoding),
    timeZone:Type.Optional(Type.String()),
  }),

  responses:{
    200: Type.Any(),

    409: Type.Object({ code: Type.Literal("TOO_MANY_DATA") }),
  },
});

export default route(ExportBillSchema, async (req, res) => {

  const { query } = req;

  const { columns, accountNames, userIdsOrNames, termStart, termEnd, type,
    searchType, count, encoding, timeZone } = query;
  let user;
  if (searchType === SearchType.selfAccount) {
    user = await authenticate((i) =>
      accountNames?.length === 1 &&
        i.accountAffiliations.some((x) => x.accountName === accountNames[0] && x.role !== UserRole.USER),
    )(req, res);
  } else if (searchType === SearchType.selfTenant) {
    user = await authenticate((i) =>
      i.tenantRoles.includes(TenantRole.TENANT_FINANCE) ||
        i.tenantRoles.includes(TenantRole.TENANT_ADMIN),
    )(req, res);
  } else {
    user = await authenticate((i) =>
      i.platformRoles.includes(PlatformRole.PLATFORM_FINANCE) ||
        i.platformRoles.includes(PlatformRole.PLATFORM_ADMIN),
    )(req, res);
  }
  if (!user) { return; }

  const logInfo = {
    operatorUserId: user.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.exportBill,
    operationTypePayload:{
      tenantName: searchType ? user.tenant : undefined,
      accountNames: accountNames ?? [],
    },
  };

  if (count > MAX_EXPORT_COUNT) {
    await callLog(logInfo, OperationResult.FAIL);
    return { 409: { code: "TOO_MANY_DATA" } } as const;

  } else {

    const client = getClient(ExportServiceClient);

    const filename = `bill-${new Date().toLocaleString("zh-CN", { timeZone: timeZone ?? "UTC" })}.csv`;
    const dispositionParm = "filename* = UTF-8''" + encodeURIComponent(filename);

    const contentTypeWithCharset = getContentTypeWithCharset(filename, encoding);

    res.writeHead(200, {
      "Content-Type":contentTypeWithCharset,
      "Content-Disposition": `attachment; ${dispositionParm}`,
    });

    const stream = asyncReplyStreamCall(client, "exportBill", {
      count,
      userIdsOrNames,
      termStart,
      termEnd,
      type,
      accountNames: accountNames ?? [],
      tenantName: searchType === SearchType.selfTenant ? user.tenant : undefined,
    });

    const languageId = getCurrentLanguageId(req, publicConfig.SYSTEM_LANGUAGE_CONFIG);
    const t = await getT(languageId);
    const p = prefix("pageComp.commonComponent.billTable.");
    const pCommon = prefix("common.");

    const formatBill = (x: BillListItem) => {
      return {
        ...x,
        amount: nullableMoneyToString(x.amount),
        ...x.details,
      };
    };

    const unit = t(pCommon("unit"));
    const fixedColumns = new Set(["accountName", "accountOwnerName", "term", "amount"]);
    const headerColumns: Record<string, string> = {
      accountName: t(pCommon("account")),
      accountOwnerName: t(pCommon("owner")),
      term: t(p("term")),
      amount: `${t(pCommon("amount"))} (${unit})`,
      ...Object.fromEntries(
        columns.filter((col) => !fixedColumns.has(col)).map((col) => [col, `${col} (${unit})`]),
      ),
    };

    const csvStringify = getBillCsvStringify(headerColumns, columns);


    const transform = getCsvObjTransform("bills", formatBill);
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
