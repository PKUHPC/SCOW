import { router } from "src/server/trpc/def";

import { clusterPartitionsInfo, currentClusters, currentClustersPartitionsInfo } from "./cluster";

export const misServerRouter = router({
  currentClusters,
  clusterPartitionsInfo,
  currentClustersPartitionsInfo,
});
