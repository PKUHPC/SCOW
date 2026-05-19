import { router } from "src/server/trpc/def";

import { createModel, deleteModel, list, updateModel } from "./model";
import {
  copyPublicModelVersion,
  createModelVersion,
  deleteModelVersion,
  getAllModelVersions,
  getMultipleModelVersions,
  shareModelVersion,
  unShareModelVersion,
  updateModelVersion,
  versionList,
} from "./modelVersion";

export const model = router({
  list,
  createModel,
  updateModel,
  deleteModel,
  copyPublicModelVersion,
  createModelVersion,
  deleteModelVersion,
  updateModelVersion,
  versionList,
  shareModelVersion,
  unShareModelVersion,
  getMultipleModelVersions,
  getAllModelVersions,
});
