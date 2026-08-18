import { JobOps, JobTemplate } from "src/clusterops/api/job";
import { configClusters } from "src/config/clusters";
import { clusterNotFound } from "src/utils/errors";
import { getScowdClient } from "src/utils/scowd";

import { scowdJobServices } from "./scowdJob";

export interface JobMetadata extends JobTemplate {
  submitTime: string;
}

export const jobOps = (cluster: string): JobOps => {
  const clusterInfo = configClusters[cluster];
  if (!clusterInfo) {
    throw clusterNotFound(cluster);
  }

  const getClient = (userId: string) => getScowdClient(cluster, userId);

  return { ...scowdJobServices(getClient) };
};
