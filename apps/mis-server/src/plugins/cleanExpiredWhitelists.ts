import { plugin } from "@ddadaal/tsgrpc-server";
import cron from "node-cron";
import { misConfig } from "src/config/mis";
import { cleanExpiredWhitelists } from "src/tasks/cleanExpiredWhitelists";

export const CleanExpiredWhitelistsPlugin = plugin(async (f) => {
  const logger = f.logger.child({ plugin: "cleanExpiredWhitelists" });

  const schedule = misConfig.cleanExpiredWhitelists?.cron ?? "0 0 * * *";

  if (!misConfig.cleanExpiredWhitelists?.enabled) {
    logger.info("cleanExpiredWhitelists plugin disabled");
    return;
  }

  const task = cron.schedule(
    schedule,
    () => {
      logger.info("Starting cleanExpiredWhitelists task");
      void cleanExpiredWhitelists(f.ext.orm.em.fork(), logger, f.ext.clusters)
        .then(() => logger.info("cleanExpiredWhitelists task completed"))
        .catch((e) => logger.error("cleanExpiredWhitelists task failed: %o", e));
    },
    {
      timezone: "Asia/Shanghai",
      runOnInit: true,
    },
  );

  logger.info("cleanExpiredWhitelists plugin started with schedule %s", schedule);

  f.addCloseHook(() => {
    task.stop();
    logger.info("cleanExpiredWhitelists plugin stopped");
  });
});
