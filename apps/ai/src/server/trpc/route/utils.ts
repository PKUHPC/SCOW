import { USE_MOCK } from "src/utils/processEnv";
import { z } from "zod";

export async function mock<T>(actualFn: () => T, mockFn: () => T) {
  if (USE_MOCK) {
    return mockFn();
  } else {
    return actualFn();
  }
}

export const pagination = z.object({
  page: z.number(),
  pageSize: z.number().default(10),
});

export function clusterExist(clusterId: string, currentClusterIds: string[]) {
  return !!currentClusterIds.includes(clusterId);
}

export const booleanQueryParam = () =>
  z.union([z.literal("true"), z.literal("false")]).transform((arg) => arg === "true");
