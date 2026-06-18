import { EntityManager } from "@mikro-orm/mysql";
import { AiJobSubmitRecord } from "src/server/entities/AiJobSubmitRecord";
import { Logger } from "ts-log";
import { z } from "zod";

/**
 * 优先从 DB 读取再次提交参数；若无记录或解析失败则调用 driverFallback 读文件（向后兼容历史作业）。
 * schema.safeParse 将 formData 与 clusterId/account 合并还原为 input 结构。
 * 注意：privateImageRepositoryCredentials 存储时已被剔除，从 DB 路径返回的结果不含该字段。
 */
export async function fetchSubmitRecord<T>(
  em: EntityManager,
  userId: string,
  clusterId: string,
  jobId: number,
  schema: z.ZodSchema<T>,
  driverFallback: () => Promise<T>,
  logger: Logger,
): Promise<T> {
  const record = await em.findOne(AiJobSubmitRecord, { userId, cluster: clusterId, jobId });
  if (record) {
    const parsed = schema.safeParse({ ...record.formData, clusterId, account: record.account });
    if (parsed.success) {
      return parsed.data;
    }
    logger.warn(
      "Failed to parse submit record formData for jobId %s, fallback to driver: %o",
      jobId, parsed.error,
    );
  }
  return driverFallback();
}
