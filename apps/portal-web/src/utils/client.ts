import { getClientFn } from "@scow/lib-web/build/utils/api";
import { runtimeConfig } from "src/utils/config";

export const getClient = getClientFn(runtimeConfig);
