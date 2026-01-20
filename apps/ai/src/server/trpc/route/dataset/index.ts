/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { router } from "src/server/trpc/def";

import { createDataset,
  deleteDataset, list, updateDataset } from "./dataset";
import { copyPublicDatasetVersion,
  createDatasetVersion, deleteDatasetVersion, getAllDatasetVersions, getMultipleDatasetVersions, shareDatasetVersion,
  unShareDatasetVersion, updateDatasetVersion, versionList } from "./datasetVersion";

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
