import { ServiceError } from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";

export const scowdClientNotFound = (cluster: string) => {
  return {
    code: Status.NOT_FOUND,
    message: `The scowd client on cluster ${cluster} was not found`,
  } as ServiceError;
};

export const clusterNotFound = (cluster: string) => {
  return { code: Status.NOT_FOUND, message: `cluster ${cluster} is not found` } as ServiceError;
};

export const jobNotFound = (jobId: number) => {
  return { code: Status.NOT_FOUND, message: `job id ${jobId} is not found` } as ServiceError;
};

export const loginNodeNotFound = (loginNode: string) => {
  return { code: Status.NOT_FOUND, message: `login node ${loginNode} is not found` } as ServiceError;
};

export const transferNotEnabled = (cluster: string) => {
  return {
    code: Status.INTERNAL,
    message: `the transmission function is not enabled for the cluster ${cluster}`,
  } as ServiceError;
};

export const transferNodeNotFound = (cluster: string) => {
  return { code: Status.NOT_FOUND, message: `transfer node of cluster ${cluster} is not found` } as ServiceError;
};
