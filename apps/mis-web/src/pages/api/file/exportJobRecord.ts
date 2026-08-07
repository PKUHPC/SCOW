import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncReplyStreamCall } from "@ddadaal/tsgrpc-client";
import { OperationType } from "@scow/lib-operation-log";
import { getCurrentLanguageId } from "@scow/lib-web/build/utils/systemLanguage";
import { JobInfo } from "@scow/protos/build/common/ended_job";
import { ExportServiceClient } from "@scow/protos/build/server/export";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { getT, prefix } from "src/i18n";
import { Encoding } from "src/models/exportFile";
import { SearchType } from "src/models/job";
import { OperationResult } from "src/models/operationLog";
import { PlatformRole, TenantRole, UserRole } from "src/models/User";
import { MAX_EXPORT_COUNT } from "src/pageComponents/file/apis";
import { buildJobsRequestTarget } from "src/pages/api/job/jobInfo";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { getClusterName } from "src/utils/cluster";
import { publicConfig } from "src/utils/config";
import {
  createEncodingTransform,
  getContentTypeWithCharset,
  getCsvObjTransform,
  getCsvStringify,
} from "src/utils/file";
import { parseJobIds } from "src/utils/jobIds";
import { nullableMoneyToString } from "src/utils/money";
import { route } from "src/utils/route";
import { parseIp } from "src/utils/server";
import { pipeline } from "stream";

export const ExportJobRecordSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    columns: Type.Array(Type.String()),
    count: Type.Number(),
    jobEndTimeStart: Type.Optional(Type.String({ format: "date-time" })),
    jobEndTimeEnd: Type.Optional(Type.String({ format: "date-time" })),
    userId: Type.Optional(Type.String()),
    userIdOrName: Type.Optional(Type.String()),
    ownerIdOrName: Type.Optional(Type.String()),
    clusters: Type.Optional(Type.Array(Type.String())),
    accountName: Type.Optional(Type.String()),
    tenantName: Type.Optional(Type.String()),
    encoding: Type.Enum(Encoding),
    timeZone: Type.Optional(Type.String()),
    jobId: Type.Optional(Type.Number()),
    jobIds: Type.Optional(Type.String()),
    finalPriceText: Type.String(),
    searchType: Type.Enum(SearchType),
    publicConfigClusters: Type.String(),
  }),

  responses: {
    200: Type.Any(),

    403: Type.Null(),

    409: Type.Object({ code: Type.Literal("TOO_MANY_DATA") }),
  },
});

export default route(ExportJobRecordSchema, async (req, res) => {
  // 和getJobInfo的auth保持一致
  const auth = authenticate(
    (u) =>
      u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN) ||
      u.tenantRoles.includes(TenantRole.TENANT_ADMIN) ||
      u.accountAffiliations.length > 0,
  );

  const info = await auth(req, res);

  if (!info) {
    return;
  }

  const { query } = req;

  const {
    columns,
    jobEndTimeStart,
    jobEndTimeEnd,
    accountName,
    count,
    userId,
    userIdOrName,
    ownerIdOrName,
    tenantName,
    encoding,
    timeZone,
    jobId,
    jobIds,
    finalPriceText,
    searchType,
    publicConfigClusters,
  } = query;
  let { clusters } = query;

  const trimmedIds = parseJobIds(jobIds);
  const isPlatformAdmin = info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN);
  const isTenantAdmin = info.tenantRoles.includes(TenantRole.TENANT_ADMIN);
  const isSelf = userId === info.identityId;

  if (
    !isPlatformAdmin &&
    !(
      (isTenantAdmin && tenantName === info.tenant) ||
      (accountName &&
        info.accountAffiliations.find(
          (x) => x.accountName === accountName && (x.role === UserRole.ADMIN || x.role === UserRole.OWNER),
        )) ||
      isSelf
    )
  ) {
    return { 403: null };
  }

  clusters = clusters ?? [];
  clusters = clusters.filter((i) => i !== "");
  const target = buildJobsRequestTarget(
    tenantName ?? "",
    jobId,
    accountName,
    userId,
    trimmedIds,
  );

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.exportJobRecord,
    operationTypePayload: {
      target,
    },
  };

  if (count > MAX_EXPORT_COUNT) {
    await callLog(logInfo, OperationResult.FAIL);
    return { 409: { code: "TOO_MANY_DATA" } } as const;
  } else {
    const client = getClient(ExportServiceClient);

    const filename = `job_record-${new Date().toLocaleString("zh-CN", { timeZone: timeZone ?? "UTC" })}.csv`;
    const dispositionParm = "filename* = UTF-8''" + encodeURIComponent(filename);

    const contentTypeWithCharset = getContentTypeWithCharset(filename, encoding);

    res.writeHead(200, {
      "Content-Type": contentTypeWithCharset,
      "Content-Disposition": `attachment; ${dispositionParm}`,
    });

    const stream = asyncReplyStreamCall(client, "exportJobRecord", {
      count,
      jobEndTimeStart,
      jobEndTimeEnd,
      target,
      clusters,
      userIdOrName: userIdOrName?.trim() || undefined,
      ownerIdOrName: ownerIdOrName?.trim() || undefined,
    });

    const languageId = getCurrentLanguageId(req, publicConfig.SYSTEM_LANGUAGE_CONFIG);
    const t = await getT(languageId);
    const pCommon = prefix("common.");
    const p = prefix("pageComp.job.historyJobDrawer.");

    const formatJobRecord = (x: JobInfo) => {
      return {
        tenantName: x.tenantName,
        idJob: x.idJob,
        jobName: x.jobName,
        account: x.account,
        user: x.user,
        userName: x.userName,
        accountOwnerId: x.accountOwnerId,
        accountOwnerName: x.accountOwnerName,
        cluster: getClusterName(x.cluster, languageId, JSON.parse(publicConfigClusters)),
        partition: x.partition,
        qos: x.qos,
        nodelist: x.nodelist,
        timeSubmit: x.timeSubmit ? new Date(x.timeSubmit).toLocaleString("zh-CN", { timeZone: timeZone ?? "UTC" }) : "",
        timeStart: x.timeStart ? new Date(x.timeStart).toLocaleString("zh-CN", { timeZone: timeZone ?? "UTC" }) : "",
        timeEnd: x.timeEnd ? new Date(x.timeEnd).toLocaleString("zh-CN", { timeZone: timeZone ?? "UTC" }) : "",
        nodesReq: x.nodesReq,
        nodesAlloc: x.nodesAlloc,
        cpusReq: x.cpusReq,
        cpusAlloc: x.cpusAlloc,
        gpu: x.gpu,
        memReq: x.memReq,
        memAlloc: x.memAlloc,
        timelimit: x.timelimit,
        timeUsed: x.timeUsed,
        timeWait: x.timeWait,
        tenantPrice: nullableMoneyToString(x.tenantPrice),
        accountPrice: nullableMoneyToString(x.accountPrice),
        recordTime: x.recordTime ? new Date(x.recordTime).toLocaleString("zh-CN", { timeZone: timeZone ?? "UTC" }) : "",
      };
    };

    const finalPriceTextObj: { tenant?: string; account?: string } = JSON.parse(finalPriceText ? finalPriceText : "");

    const clusterColumnsName = searchType === SearchType.NORMAL ? t(pCommon("clusterName")) : t(pCommon("cluster"));

    const headerColumns = {
      tenantName: t(pCommon("tenant")),
      jobName: t(pCommon("workName")),
      idJob: t(pCommon("clusterWorkId")),
      user: t(pCommon("userId")),
      userName: t(pCommon("userName")),
      account: t(pCommon("account")),
      accountOwnerId: t(pCommon("accountOwnerId")),
      accountOwnerName: t(pCommon("accountOwnerName")),
      cluster: clusterColumnsName,
      partition: t(pCommon("partition")),
      qos: "QOS",
      nodelist: t(p("list")),
      timeSubmit: t(p("timeSubmit")),
      timeStart: t(p("timeStart")),
      timeEnd: t(p("timeEnd")),
      nodesReq: t(p("nodesReq")),
      nodesAlloc: t(p("nodesAlloc")),
      cpusReq: t(p("cpusReq")),
      cpusAlloc: t(p("cpusAlloc")),
      gpu: t(p("gpus")),
      memReq: t(p("memReq")),
      memAlloc: t(p("memAlloc")),
      timelimit: t(p("timeLimit")),
      timeUsed: t(p("timeUsed")),
      timeWait: t(p("timeWait")),
      recordTime: t(p("recordTime")),
    };

    for (const price in finalPriceTextObj) {
      headerColumns[price + "Price"] = finalPriceTextObj[price];
    }

    const csvStringify = getCsvStringify(headerColumns, columns);
    const transform = getCsvObjTransform("jobRecords", formatJobRecord);
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
