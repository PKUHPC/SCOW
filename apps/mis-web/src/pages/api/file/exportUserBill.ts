import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncReplyStreamCall } from "@ddadaal/tsgrpc-client";
import { OperationType } from "@scow/lib-operation-log";
import { getCurrentLanguageId } from "@scow/lib-web/build/utils/systemLanguage";
import { BillListItem } from "@scow/protos/build/server/bill";
import { ExportServiceClient } from "@scow/protos/build/server/export";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { getT, prefix } from "src/i18n";
import { Encoding } from "src/models/exportFile";
import { OperationResult } from "src/models/operationLog";
import { PlatformRole, TenantRole, UserRole } from "src/models/User";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { publicConfig } from "src/utils/config";
import {
  createEncodingTransform,
  getBillCsvStringify,
  getContentTypeWithCharset,
  getCsvObjTransform,
} from "src/utils/file";
import { nullableMoneyToString } from "src/utils/money";
import { route } from "src/utils/route";
import { parseIp } from "src/utils/server";
import { pipeline } from "stream";

export const exportUserBillSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    columns: Type.Array(Type.String()),
    count: Type.Number(),

    accountName: Type.String(),
    accountBillIds: Type.Array(Type.String()),

    encoding: Type.Enum(Encoding),
    timeZone: Type.Optional(Type.String()),
  }),

  responses: {
    200: Type.Any(),

    409: Type.Object({ code: Type.Literal("TOO_MANY_DATA") }),
  },
});

export default route(exportUserBillSchema, async (req, res) => {
  const { query } = req;

  const { columns, accountName, accountBillIds, encoding, timeZone } = query;

  // 租户、平台、账户的管理员或财务管理员才能导出
  const auth = authenticate(
    (info) =>
      info.tenantRoles.includes(TenantRole.TENANT_ADMIN) ||
      info.tenantRoles.includes(TenantRole.TENANT_FINANCE) ||
      info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN) ||
      info.platformRoles.includes(PlatformRole.PLATFORM_FINANCE) ||
      info.accountAffiliations.some((x) => x.accountName === accountName && x.role !== UserRole.USER),
  );
  const user = await auth(req, res);

  if (!user) {
    return;
  }

  const logInfo = {
    operatorUserId: user.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.exportUserBill,
    operationTypePayload: {
      accountName,
    },
  };

  const client = getClient(ExportServiceClient);

  const filename = `bill-detail-${accountName}-${new Date().toLocaleString("zh-CN", {
    timeZone: timeZone ?? "UTC",
  })}.csv`;
  const dispositionParm = "filename* = UTF-8''" + encodeURIComponent(filename);

  const contentTypeWithCharset = getContentTypeWithCharset(filename, encoding);

  res.writeHead(200, {
    "Content-Type": contentTypeWithCharset,
    "Content-Disposition": `attachment; ${dispositionParm}`,
  });

  const stream = asyncReplyStreamCall(client, "exportUserBill", {
    accountBillIds: accountBillIds.map((i) => Number(i)),
  });

  const languageId = getCurrentLanguageId(req, publicConfig.SYSTEM_LANGUAGE_CONFIG);
  const t = await getT(languageId);
  const pCommon = prefix("common.");

  const formatBill = (x: BillListItem) => {
    return {
      ...x,
      amount: nullableMoneyToString(x.amount),
      ...x.details,
    };
  };

  const headerColumns = {
    name: t(pCommon("name")),
    userId: t(pCommon("userId")),
    amount: t(pCommon("amount")),
  };

  const csvStringify = getBillCsvStringify(headerColumns, columns);

  const transform = getCsvObjTransform("userBills", formatBill);
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
});
