import { router } from "src/server/trpc/def";

import { createAlgorithm, deleteAlgorithm, getAlgorithms, updateAlgorithm } from "./algorithm";
import {
  copyPublicAlgorithmVersion,
  createAlgorithmVersion,
  deleteAlgorithmVersion,
  getAlgorithmVersions,
  getAllAlgorithmVersions,
  getMultipleAlgorithmVersions,
  shareAlgorithmVersion,
  unShareAlgorithmVersion,
  updateAlgorithmVersion,
} from "./algorithmVersion";

export const algorithm = router({
  getAlgorithms,
  createAlgorithm,
  updateAlgorithm,
  deleteAlgorithm,
  copyPublicAlgorithmVersion,
  getAlgorithmVersions,
  createAlgorithmVersion,
  updateAlgorithmVersion,
  deleteAlgorithmVersion,
  shareAlgorithmVersion,
  unShareAlgorithmVersion,
  getMultipleAlgorithmVersions,
  getAllAlgorithmVersions,
});
