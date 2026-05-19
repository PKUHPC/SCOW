import { TRPCError } from "@trpc/server";

export const clusterNotFound = (cluster: string) => {
  return { code: "NOT_FOUND", message: `cluster ${cluster} is not found` } as TRPCError;
};
