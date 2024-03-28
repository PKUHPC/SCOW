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
import { getCurrentLanguageId } from "@scow/lib-web/build/utils/systemLanguage";
import { PaymentRecord } from "@scow/protos/build/server/charging";
import { ExportServiceClient } from "@scow/protos/build/server/export";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { getT, prefix } from "src/i18n";
import { OperationResult, OperationType } from "src/models/operationLog";
import { PlatformRole, TenantRole, UserRole } from "src/models/User";
import { SearchType } from "src/pageComponents/common/PaymentTable";
import { MAX_EXPORT_COUNT } from "src/pageComponents/file/apis";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { publicConfig } from "src/utils/config";
import { getCsvObjTransform, getCsvStringify } from "src/utils/file";
import { nullableMoneyToString } from "src/utils/money";
import { route } from "src/utils/route";
import { getContentType, parseIp } from "src/utils/server";
import { pipeline } from "stream";

import { getTenantOfAccount } from "../finance/charges";
import { getPaymentRecordTarget } from "../finance/payments";

export const ExportPayRecordSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    columns: Type.Array(Type.String()),
    count: Type.Number(),
    startTime: Type.String({ format: "date-time" }),
    endTime: Type.String({ format: "date-time" }),
    targetName: Type.Optional(Type.Array(Type.String())),
    searchType: Type.Enum(SearchType),
    type:Type.Array(Type.String()),
  }),

  responses:{
    200: Type.Any(),

    409: Type.Object({ code: Type.Literal("TOO_MANY_DATA") }),
  },
});

export default route(ExportPayRecordSchema, async (req, res) => {

  const { query } = req;

  const { columns, startTime, endTime, targetName, searchType, count, type } = query;

  let user;
  if (searchType === SearchType.tenant) {
    user = await authenticate((i) => i.platformRoles.includes(PlatformRole.PLATFORM_FINANCE) ||
    i.platformRoles.includes(PlatformRole.PLATFORM_ADMIN))(req, res);
  } else {
    if (targetName) {
      user = await authenticate((i) =>
        i.tenantRoles.includes(TenantRole.TENANT_FINANCE) ||
          i.tenantRoles.includes(TenantRole.TENANT_ADMIN) ||
          // 排除掉前面的租户财务员和管理员，只剩下账户管理员
          targetName.length === 1 &&
          i.accountAffiliations.some((x) => x.accountName === targetName[0] && x.role !== UserRole.USER),
      )(req, res);
    } else {
      user = await authenticate((i) =>
        i.tenantRoles.includes(TenantRole.TENANT_FINANCE) ||
          i.tenantRoles.includes(TenantRole.TENANT_ADMIN),
      )(req, res);
    }
  }

  if (!user) { return; }

  const tenantOfAccount = searchType === SearchType.account
    ? await getTenantOfAccount(targetName, user)
    : user.tenantId;

  const target = getPaymentRecordTarget(searchType, user, tenantOfAccount, targetName);

  const logInfo = {
    operatorUserId: user.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.exportPayRecord,
    operationTypePayload:{
      target,
    },
  };

  if (count > MAX_EXPORT_COUNT) {
    await callLog(logInfo, OperationResult.FAIL);
    return { 409: { code: "TOO_MANY_DATA" } } as const;

  } else {

    const client = getClient(ExportServiceClient);

    const filename = `pay_record-${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}.csv`;
    const dispositionParm = "filename* = UTF-8''" + encodeURIComponent(filename);

    res.writeHead(200, {
      "Content-Type": getContentType(filename, "application/octet-stream"),
      "Content-Disposition": `attachment; ${dispositionParm}`,
    });

    const stream = asyncReplyStreamCall(client, "exportPayRecord", {
      count,
      startTime,
      endTime,
      target,
      type,
    });

    const languageId = getCurrentLanguageId(req, publicConfig.SYSTEM_LANGUAGE_CONFIG);
    const t = await getT(languageId);
    const p = prefix("pageComp.commonComponent.paymentTable.");
    const pCommon = prefix("common.");

    const formatPayRecord = (x: PaymentRecord) => {
      return {
        id: x.index,
        accountName: x.accountName,
        tenantName: x.tenantName,
        time: x.time ? new Date(x.time).toISOString() : "",
        amount: nullableMoneyToString(x.amount),
        type: x.type,
        ipAddress: x.ipAddress,
        operatorId: x.operatorId,
        comment: x.comment,
      };
    };

    const headerColumns = {
      id: "ID",
      accountName: t(pCommon("account")),
      tenantName: t(pCommon("tenant")),
      time: t(p("paymentDate")),
      amount: t(p("paymentAmount")),
      type: t(pCommon("type")),
      ipAddress:  t(p("ipAddress")),
      operatorId: t(p("operatorId")),
      comment: t(pCommon("comment")),
    };
    const csvStringify = getCsvStringify(headerColumns, columns);

    const transform = getCsvObjTransform("payRecords", formatPayRecord);

    pipeline(
      stream,
      transform,
      csvStringify,
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
