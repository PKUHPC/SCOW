import { getAiConfig } from "@scow/config/build/ai";
import { getAppConfigs } from "@scow/config/build/app";
import { getClusterConfigs } from "@scow/config/build/cluster";
import { getClusterTextsConfig } from "@scow/config/build/clusterTexts";
import { getCommonConfig } from "@scow/config/build/common";
import { getMisConfig } from "@scow/config/build/mis";
import { getNotificationConfig } from "@scow/config/build/notification";
import { getPortalConfig } from "@scow/config/build/portal";
import { getResourceConfig } from "@scow/config/build/resource";
import { getUiConfig } from "@scow/config/build/ui";
import { Logger } from "pino";
import { getInstallConfig } from "src/config/install";
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
  const commonConfig = tryRead(getCommonConfig);

  logger.debug("Checking cluster config files");
  tryRead(getClusterConfigs);

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

  if (config.mis) {
    logger.debug("Checking MIS configuration");
    tryRead(getMisConfig);
  } else {
    logger.debug("MIS is not deployed. Skip MIS config check.");
  }

  if (config.ai) {
    logger.debug("Checking AI configuration");
    tryRead(getAiConfig);
  } else {
    logger.debug("AI is not deployed. Skip AI config check.");
  }

  if (config.resource) {
    logger.debug("Checking resource configuration");
    tryRead(getResourceConfig);

    // 检查 scowApi.token 配置 - resource 模块需要此配置
    if (!commonConfig?.scowApi?.auth?.token) {
      logger.error("scowApi.auth.token is required for resource module but not configured in common config");
      if (!continueOnError) {
        process.exit(1);
      }
    }
  } else {
    logger.debug("Resource is not deployed. Skip resource config check.");
  }

  if (config.notification) {
    logger.debug("Checking notification configuration");
    tryRead(getNotificationConfig);

    // 检查 scowApi.token 配置 - notification 模块需要此配置
    if (!commonConfig?.scowApi?.auth?.token) {
      logger.error("scowApi.auth.token is required for notification module but not configured in common config");
      if (!continueOnError) {
        process.exit(1);
      }
    }
  } else {
    logger.debug("Notification is not deployed. Skip notification config check.");
  } // 这里要加quantum吗?
};
