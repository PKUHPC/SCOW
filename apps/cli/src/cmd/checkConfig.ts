/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { getAiConfig } from "@scow/config/build/ai";
import { getAppConfigs } from "@scow/config/build/app";
import { getClusterConfigs } from "@scow/config/build/cluster";
import { getClusterTextsConfig } from "@scow/config/build/clusterTexts";
import { getCommonConfig } from "@scow/config/build/common";
import { getMisConfig } from "@scow/config/build/mis";
import { getPortalConfig } from "@scow/config/build/portal";
import { getUiConfig } from "@scow/config/build/ui";
import { Logger } from "pino";
import { getInstallConfig } from "src/config/install";
import { logger } from "src/log";

interface Options {
  configPath: string;
  continueOnError: boolean;
  scowConfigPath: string;
}


export const checkConfig = ({
  configPath, continueOnError, scowConfigPath,
}: Options) => {

  const config = getInstallConfig(configPath);

  const tryRead = (readFn: (path: string, logger: Logger) => any) => {
    try {
      readFn(scowConfigPath, logger);
    } catch (e) {
      logger.error(e);
      if (!continueOnError) {
        process.exit(1);
      }
    }
  };

  logger.debug("Checking common config");
  tryRead(getCommonConfig);

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
  } // 这里要加quantum吗?
};
