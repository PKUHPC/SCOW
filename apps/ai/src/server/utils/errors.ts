import { TRPCError } from "@trpc/server";

export const clusterNotFound = (cluster: string) => {
  return { code: "NOT_FOUND", message: `cluster ${cluster} is not found` } as TRPCError;
};

export const clusterBackendNotSupported = (cluster: string) => {
  return {
    code: "PRECONDITION_FAILED",
    message: `cluster ${cluster} does not support the current backend. Please enable scowd for this cluster.`,
  } as TRPCError;
};

export const loginNodeNotFound = (loginNode: string) => {
  return { code: "NOT_FOUND", message: `login node ${loginNode} is not found` } as TRPCError;
};

export const scowdClientNotFound = (cluster: string) => {
  return {
    code: "NOT_FOUND",
    message: `The scowd client on cluster ${cluster} was not found`,
  } as TRPCError;
};
