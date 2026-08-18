import { getClientFn } from "@scow/lib-server/build/api";
import { commonConfig } from "src/server/config/common";
import { config } from "src/server/config/env";

export const getPortalClient = getClientFn(config.PORTAL_SERVER_URL, commonConfig.scowApi.auth.token);

export const getMisClient = getClientFn(config.MIS_SERVER_URL, commonConfig.scowApi.auth.token);
