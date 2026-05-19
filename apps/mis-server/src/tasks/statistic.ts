import { Logger } from "@ddadaal/tsgrpc-server";
import { MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
import {
  getChargeRecordsTotalCountCached,
  getJobTotalCountCached,
  getTotalStatisticsInfoCached,
} from "src/utils/cache";

export let lastFetched: Date | null = null;

export async function fetchStatistics(em: SqlEntityManager<MySqlDriver>, logger: Logger) {
  logger.info("Start fetchStatistics.");

  try {
    await getTotalStatisticsInfoCached(em);

    await getJobTotalCountCached(em);

    await getChargeRecordsTotalCountCached(em);

    lastFetched = new Date();

    const fetchSuccsess = true;

    return { fetchSuccsess };
  } catch (e) {
    logger.error("Error when fetching jobs. %o", e);
    throw e;
  }
}
