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

import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ClusterConfigSchema } from "@scow/config/build/cluster";
import { getClusterConfigsTypeFormat } from "@scow/lib-web/build/utils/typeConversion";
import { ConfigServiceClient } from "@scow/protos/build/common/config";
import { getClient } from "src/utils/client";

export async function getClusterConfigFiles(): Promise<Record<string, ClusterConfigSchema>> {

  const client = getClient(ConfigServiceClient);
  const result = await asyncClientCall(client, "getClusterConfigFiles", {});

  const modifiedClusters: Record<string, ClusterConfigSchema> = getClusterConfigsTypeFormat(result.clusterConfigs);

  return modifiedClusters;

}
