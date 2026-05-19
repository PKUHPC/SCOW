import { router } from "src/server/trpc/def";

import { createDataset, deleteDataset, list, updateDataset } from "./dataset";
import {
  copyPublicDatasetVersion,
  createDatasetVersion,
  deleteDatasetVersion,
  getAllDatasetVersions,
  getMultipleDatasetVersions,
  shareDatasetVersion,
  unShareDatasetVersion,
  updateDatasetVersion,
  versionList,
} from "./datasetVersion";

export const dataset = router({
  list,
  createDataset,
  updateDataset,
  deleteDataset,
  versionList,
  copyPublicDatasetVersion,
  createDatasetVersion,
  updateDatasetVersion,
  deleteDatasetVersion,
  shareDatasetVersion,
  unShareDatasetVersion,
  getMultipleDatasetVersions,
  getAllDatasetVersions,
});
