import { plugin } from "@ddadaal/tsgrpc-server";
import cron from "node-cron";
import { misConfig } from "src/config/mis";
import { fetchJobs, lastFetched } from "src/tasks/fetch";

export interface FetchPlugin {
  fetch: {
    started: () => boolean;
    start: () => void;
    stop: () => void;
    schedule: string;
    lastFetched: () => Date | null;
    fetch: () => Promise<{ newJobsCount: number }>;
    isRunning: boolean;
  };
}

export const fetchPlugin = plugin(async (f) => {
  let fetchStarted = !!misConfig.fetchJobs.periodicFetch?.enabled;
  let fetchIsRunning = false;

  const logger = f.logger.child({ plugin: "fetch" });

  const trigger = () => {
    if (fetchIsRunning) return;

    fetchIsRunning = true;
    return fetchJobs(f.ext.orm.em.fork(), logger, f.ext).finally(() => {
      fetchIsRunning = false;
    });
  };

  const task = cron.schedule(
    misConfig.fetchJobs.periodicFetch.cron,
    () => {
      void trigger()?.catch((e) => {
        logger.error("Error when fetching jobs. %o", e);
      });
    },
    {
      timezone: "Asia/Shanghai",
      scheduled: misConfig.fetchJobs.periodicFetch.enabled,
    },
  );

  logger.info("Fetch info started.");

  f.addCloseHook(() => {
    task.stop();
    logger.info("Fetch info stopped.");
  });

  f.addExtension("fetch", {
    started: () => fetchStarted,
    start: () => {
      if (fetchStarted) {
        logger.info("Fetch is requested to start but already started");
      } else {
        task.start();
        fetchStarted = true;
        logger.info("Fetch started");
      }
    },
    stop: () => {
      if (!fetchStarted) {
        logger.info("Fetch is requested to stop but already stopped");
      } else {
        task.stop();
        fetchStarted = false;
        logger.info("Fetch stopped");
      }
    },
    schedule: misConfig.fetchJobs.periodicFetch.cron,
    lastFetched: () => lastFetched,
    fetch: trigger,
    isRunning: fetchIsRunning,
  } as FetchPlugin["fetch"]);
});
