import { plugin } from "@ddadaal/tsgrpc-server";
import cron from "node-cron";
import { misConfig } from "src/config/mis";
import { getActivatedClusters } from "src/bl/clustersUtils";
import { runStorageBilling } from "src/tasks/storageBilling";

export interface StorageBillingPlugin {
  storageBilling: {
    started: () => boolean;
    start: () => void;
    stop: () => void;
    schedule: string;
    isRunning: boolean;
  };
}

export const storageBillingPlugin = plugin(async (f) => {

  const storageBillingConfig = misConfig.storageBilling;
  if (!storageBillingConfig?.enabled) {
    f.logger.info("Storage billing is disabled, plugin not loaded.");
    return;
  }

  const schedule = storageBillingConfig.cron;
  let billingStarted = true;
  let billingIsRunning = false;

  const logger = f.logger.child({ plugin: "storageBilling" });

  const trigger = async () => {
    if (billingIsRunning) return;

    billingIsRunning = true;
    try {
      const currentActivatedClusters = await getActivatedClusters(f.ext.orm.em.fork(), logger);
      await runStorageBilling(
        f.ext.orm.em.fork(),
        logger,
        currentActivatedClusters,
        f.ext,
      );
    } catch (e) {
      logger.error("Error during storage billing: %o", e);
    } finally {
      billingIsRunning = false;
    }
  };

  const task = cron.schedule(
    schedule,
    () => { void trigger(); },
    {
      timezone: "Asia/Shanghai",
      scheduled: true,
    },
  );

  logger.info("Storage billing plugin started with schedule: %s", schedule);

  f.addCloseHook(() => {
    task.stop();
    logger.info("Storage billing plugin stopped.");
  });

  f.addExtension("storageBilling", {
    started: () => billingStarted,
    start: () => {
      if (billingStarted) {
        logger.info("Storage billing already started");
      } else {
        task.start();
        billingStarted = true;
        logger.info("Storage billing started");
      }
    },
    stop: () => {
      if (!billingStarted) {
        logger.info("Storage billing already stopped");
      } else {
        task.stop();
        billingStarted = false;
        logger.info("Storage billing stopped");
      }
    },
    schedule,
    isRunning: billingIsRunning,
  } as StorageBillingPlugin["storageBilling"]);
});
