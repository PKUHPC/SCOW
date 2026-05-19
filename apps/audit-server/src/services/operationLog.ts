import { createWriterExtensions, ServiceError } from "@ddadaal/tsgrpc-common";
import { ensureNotUndefined, plugin } from "@ddadaal/tsgrpc-server";
import { status } from "@grpc/grpc-js";
import { QueryOrder, raw } from "@mikro-orm/core";
import {
  OperationLogServiceServer,
  OperationLogServiceService,
  operationResultToJSON,
} from "@scow/protos/build/audit/operation_log";
import { I18nObject } from "@scow/protos/build/common/i18n";
import { OperationLog, OperationResult } from "src/entities/OperationLog";
import {
  addOperationLogAccountNames,
  checkCustomEventType,
  filterOperationLogs,
  getTargetAccountName,
  toGrpcOperationLog,
} from "src/utils/operationLogs";
import { DEFAULT_PAGE_SIZE, paginationProps } from "src/utils/orm";
import { generateOperationOptions } from "src/utils/querryOptions";

export const operationLogServiceServer = plugin((server) => {
  server.addService<OperationLogServiceServer>(OperationLogServiceService, {
    createOperationLog: async ({ request, em }) => {
      const { operatorUserId, operatorIp, operationResult, operationEvent } = request;

      if (!operationEvent) {
        return [];
      }
      const targetAccountName = getTargetAccountName(operationEvent);

      const dbOperationResult: OperationResult = OperationResult[operationResultToJSON(operationResult)];

      await checkCustomEventType(em, operationEvent);

      const operationLog = new OperationLog({
        operatorUserId,
        operatorIp,
        operationResult: dbOperationResult,
        metaData: targetAccountName ? { ...operationEvent, targetAccountName } : operationEvent,
        customEventType: operationEvent.$case === "customEvent" ? operationEvent.customEvent.type : undefined,
      });
      await em.persistAndFlush(operationLog);
      return [];
    },

    getOperationLogs: async ({ request, em, logger }) => {
      const { filter, page, pageSize, sortBy, sortOrder } = ensureNotUndefined(request, ["filter", "page"]);

      const sqlFilter = await filterOperationLogs(filter);

      logger.info("getOperationLogs sqlFilter %s", JSON.stringify(sqlFilter));

      let operationLogs, count;

      if (sortBy !== undefined && sortBy !== undefined) {
        [operationLogs, count] = await em.findAndCount(OperationLog, sqlFilter, {
          ...generateOperationOptions(page, pageSize, sortBy, sortOrder),
        });
      } else {
        [operationLogs, count] = await em.findAndCount(OperationLog, sqlFilter, {
          ...paginationProps(page, pageSize || DEFAULT_PAGE_SIZE),
        });
      }

      const res = operationLogs.map(toGrpcOperationLog);

      const addAccountNamesRes = res.map(addOperationLogAccountNames);
      return [
        {
          results: addAccountNamesRes,
          totalCount: count,
        },
      ];
    },

    exportOperationLog: async (call) => {
      const { em, request } = call;
      const { count, filter } = ensureNotUndefined(request, ["filter"]);

      const sqlFilter = await filterOperationLogs(filter);

      const batchSize = 5000;
      let offset = 0;

      const { writeAsync } = createWriterExtensions(call);

      type RecordFormatReturnType = ReturnType<typeof toGrpcOperationLog>;

      while (offset < count) {
        const limit = Math.min(batchSize, count - offset);
        const operationLogs = await em.find(OperationLog, sqlFilter, {
          orderBy: { operationTime: QueryOrder.DESC },
        });

        const records = operationLogs.map(toGrpcOperationLog);
        const addAccountNamesRecords = records.map(addOperationLogAccountNames);
        if (addAccountNamesRecords.length === 0) {
          break;
        }

        let data: RecordFormatReturnType[] = [];
        // 记录传输的总数量
        let writeTotal = 0;

        for (const row of addAccountNamesRecords) {
          data.push(row);
          writeTotal += 1;
          if (data.length === 200 || writeTotal === addAccountNamesRecords.length) {
            await new Promise((resolve) => {
              void writeAsync({ operationLogs: data }).then(() => {
                // 清空暂存
                data = [];
                resolve("done");
              });
            }).catch((e) => {
              throw {
                code: status.INTERNAL,
                message: "Error when exporting file",
                details: e?.message,
              } as ServiceError;
            });
          }
        }
        offset += limit;
      }
    },

    getCustomEventTypes: async ({ em }) => {
      const qb = em.createQueryBuilder(OperationLog, "o");
      void qb
        .select([
          raw("DISTINCT o.custom_event_type as customType"),
          raw("JSON_UNQUOTE(JSON_EXTRACT(meta_data, '$.customEvent.name')) AS name"),
        ])
        .where("o.custom_event_type IS NOT NULL");

      const results: { customType: string; name: string }[] = await qb.execute();

      const customEventTypes = results.map((r) => ({
        type: r.customType,
        name: JSON.parse(r.name) as I18nObject,
      }));
      return [
        {
          customEventTypes,
        },
      ];
    },
  });
});
