import { raw } from "@mikro-orm/core";
import { MySqlDriver, QueryBuilder, SqlEntityManager } from "@mikro-orm/mysql";
import { Account } from "src/entities/Account";
import { ChargeRecord } from "src/entities/ChargeRecord";
import { JobInfo as JobInfoEntity } from "src/entities/JobInfo";
import { QueryCache } from "src/entities/QueryCache";
import { Tenant } from "src/entities/Tenant";
import { User } from "src/entities/User";

const executeQuery = async (queryExecutor: (() => Promise<any>) | QueryBuilder<any>): Promise<any> => {
  if (typeof queryExecutor === "function") {
    return queryExecutor();
  } else {
    return queryExecutor.execute();
  }
};

export const queryWithCache = async ({
  em,
  queryKeys,
  queryExecutor,
  cacheOptions,
}: {
  em: SqlEntityManager<MySqlDriver>;
  queryKeys: string[];
  queryExecutor: (() => Promise<any>) | QueryBuilder<any>;
  cacheOptions?: {
    maxAgeMilliseconds?: number;
    enabled?: boolean;
  };
}): Promise<{ result: any; refreshTime: Date }> => {
  const { maxAgeMilliseconds = 5 * 60 * 1000, enabled = true } = cacheOptions || {};

  if (!enabled) {
    return await executeQuery(queryExecutor);
  }

  const queryKey = queryKeys.join(":");

  const queryCache = await em.findOne(QueryCache, { queryKey });

  const now = new Date();

  if (!queryCache) {
    const newResult = await executeQuery(queryExecutor);
    const newQueryCache = new QueryCache({ queryKey, queryResult: newResult, timestamp: now });
    await em.persistAndFlush(newQueryCache);
    return { result: newResult, refreshTime: now };
  }

  if (now.getTime() - queryCache.timestamp.getTime() > maxAgeMilliseconds) {
    const newResult = await executeQuery(queryExecutor);
    queryCache.queryResult = newResult;
    queryCache.timestamp = now;
    await em.persistAndFlush(queryCache);
    return { result: newResult, refreshTime: now };
  } else {
    return { result: queryCache.queryResult, refreshTime: queryCache.timestamp };
  }
};

export const getTotalStatisticsInfoCached = async (
  em: SqlEntityManager<MySqlDriver>,
): Promise<{ result: any; refreshTime: Date }> => {
  return await queryWithCache({
    em,
    queryKeys: ["get_total_statistic_info"],
    queryExecutor: async () => {
      const totalUser = await em.count(User, {});
      const totalAccount = await em.count(Account, {});
      const totalTenant = await em.count(Tenant, {});
      return { totalUser, totalAccount, totalTenant };
    },
    cacheOptions: {
      maxAgeMilliseconds: 24 * 60 * 60 * 1000,
    },
  });
};

export const getJobTotalCountCached = async (
  em: SqlEntityManager<MySqlDriver>,
): Promise<{ result: any; refreshTime: Date }> => {
  return await queryWithCache({
    em,
    queryKeys: ["get_job_total_count"],
    queryExecutor: async () => {
      const count = await em.count(JobInfoEntity, {});
      return { count };
    },
    cacheOptions: {
      maxAgeMilliseconds: 24 * 60 * 60 * 1000,
    },
  });
};

export const getChargeRecordsTotalCountCached = async (
  em: SqlEntityManager<MySqlDriver>,
): Promise<{ result: any; refreshTime: Date }> => {
  const qb = em
    .createQueryBuilder(ChargeRecord, "c")
    .select([raw("count(c.id) as total_count"), raw("sum(c.amount) as total_amount")])
    .where({
      time: { $gte: new Date(0).toISOString(), $lte: new Date().toISOString() },
      ...{ accountName: { $ne: null } },
    });

  return await queryWithCache({
    em,
    queryKeys: ["get_charge_records_total_count"],
    queryExecutor: qb,
    cacheOptions: { maxAgeMilliseconds: 24 * 60 * 60 * 1000 },
  });
};
