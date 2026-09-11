import { getAiConfig } from "@scow/config/build/ai";
import { getAppConfigs } from "@scow/config/build/app";
import { getAuditConfig } from "@scow/config/build/audit";
import { getClusterConfigs } from "@scow/config/build/cluster";
import { getServerStorageConfig } from "@scow/config/build/storage";
import { getClusterTextsConfig } from "@scow/config/build/clusterTexts";
import { getCommonConfig } from "@scow/config/build/common";
import { getMisConfig } from "@scow/config/build/mis";
import { getNotificationConfig } from "@scow/config/build/notification";
import { getPortalConfig } from "@scow/config/build/portal";
import { getResourceConfig } from "@scow/config/build/resource";
import { getUiConfig } from "@scow/config/build/ui";
import { Logger } from "pino";
import { getInstallConfig } from "src/config/install";
import { validateClusterAiConfig } from "src/config/validateClusterAiConfig";
import { logger } from "src/log";

interface Options {
  configPath: string;
  continueOnError: boolean;
  scowConfigPath: string;
}

export const checkConfig = ({ configPath, continueOnError, scowConfigPath }: Options) => {
  const config = getInstallConfig(configPath);

  const tryRead = <T>(readFn: (path: string, logger: Logger) => T): T | null => {
    try {
      return readFn(scowConfigPath, logger);
    } catch (e) {
      logger.error(e);
      if (!continueOnError) {
        process.exit(1);
      }
      return null;
    }
  };

  logger.debug("Checking common config");
  tryRead(getCommonConfig);

  logger.debug("Checking cluster config files");
  const clusterConfigs = tryRead(getClusterConfigs);

  logger.debug("Checking storage config");
  tryRead(getServerStorageConfig);

  logger.debug("Checking clusterTexts config");
  tryRead(getClusterTextsConfig);

  logger.debug("Checking UI config");
  tryRead(getUiConfig);

  if (config.portal) {
    logger.debug("Checking portal config");
    tryRead(getPortalConfig);

    logger.debug("Checking app config");
    tryRead(getAppConfigs);
  } else {
    logger.debug("Portal is not deployed. Skip portal config check.");
  }

  logger.debug("Checking MIS configuration");
  tryRead(getMisConfig);

  logger.debug("Checking audit configuration");
  tryRead(getAuditConfig);

  if (config.ai?.enabled) {
    logger.debug("Checking AI configuration");
    tryRead(getAiConfig);

    if (clusterConfigs) {
      try {
        validateClusterAiConfig(clusterConfigs, scowConfigPath);
      } catch (e) {
        logger.error(e);
        if (!continueOnError) {
          process.exit(1);
        }
      }
    }
  } else {
    logger.debug("AI is not deployed. Skip AI config check.");
  }

  logger.debug("Checking resource configuration");
  tryRead(getResourceConfig);

  logger.debug("Checking notification configuration");
  tryRead(getNotificationConfig);
};
