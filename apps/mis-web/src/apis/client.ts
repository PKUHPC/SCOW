import { createApiClient } from "@ddadaal/next-typed-api-routes-runtime/lib/client";
import { publicConfig } from "src/utils/config";

export const apiClient = createApiClient({
  baseUrl:
    (typeof window === "undefined" ? `http://localhost:${process.env.PORT ?? 3000}` : "") +
    (publicConfig.BASE_PATH === "/" ? "" : publicConfig.BASE_PATH),
});
