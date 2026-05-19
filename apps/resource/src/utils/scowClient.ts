import { getClientFn } from "@scow/lib-server";
import { commonConfig } from "src/server/config/common";
import { config } from "src/server/config/env";
import { scowConfig } from "src/server/config/scow";

export const getScowClient = getClientFn(
  config.MIS_SERVER_URL || scowConfig.misServerUrl,
  commonConfig.scowApi?.auth?.token,
);
