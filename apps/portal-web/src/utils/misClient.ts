import { getClientFn } from "@scow/lib-web/build/utils/api";
import { publicConfig, runtimeConfig } from "src/utils/config";

export const getMisClient = getClientFn({
  SERVER_URL: publicConfig.MIS_SERVER_URL,
  SCOW_API_AUTH_TOKEN: runtimeConfig.SCOW_API_AUTH_TOKEN,
});
