import getConfig from "next/config";

export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "1";

const { publicRuntimeConfig } = getConfig();
export const BASE_PATH = publicRuntimeConfig.BASE_PATH || "/";

