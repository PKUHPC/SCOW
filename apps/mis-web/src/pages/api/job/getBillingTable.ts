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

import { typeboxRoute, typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ConfigServiceClient } from "@scow/protos/build/common/config";
import { JobBillingItem } from "@scow/protos/build/server/job";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { PlatformRole, UserInfo } from "src/models/User";
import { getBillingItems } from "src/pages/api/job/getBillingItems";
import { getClient } from "src/utils/client";
import { publicConfig, runtimeConfig } from "src/utils/config";
import { moneyToString } from "src/utils/money";

import { getUserStatus } from "../dashboard/status";
import { Partition } from "../getAvailablePartitions";

// Cannot use JobBillingTableItem from /components/JobBillingTable
export const JobBillingTableItem = Type.Object({
  index: Type.Number(),

  cluster: Type.String(),
  clusterItemIndex: Type.Number(),
  priceItem: Type.Optional(Type.Object({
    itemId: Type.String(),
    price: Type.String(),
    amount: Type.String(),
  })),

  partition: Type.String(),
  partitionCount: Type.Number(),

  partitionItemIndex: Type.Number(),

  qos: Type.String(),
  qosCount: Type.Number(),
  nodes: Type.Number(),
  mem: Type.Number(),
  cores: Type.Number(),
  gpus: Type.Number(),
  path: Type.String(),
  comment: Type.Optional(Type.String()),

});
export type JobBillingTableItem = Static<typeof JobBillingTableItem>;

export const GetBillingTableSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    /**
     * Platform admin can query any tenant
     * Not login user can only query platform default (by not setting the tenant field)
     * Login user can only query the platform default and tenant the user belongs to
     */
    tenant: Type.Optional(Type.String()),
  }),

  responses: {
    200: Type.Object({ items: Type.Array(JobBillingTableItem) }),
  },
});

async function getAvailablePartitionForItems(
  client: ConfigServiceClient, cluster: string, user: UserInfo): Promise<Partition[]> {

  const statuses = await getUserStatus(user.identityId, user.tenant);
  const accountNames = Object.keys(statuses.accountStatuses).filter(
    (key) => !statuses.accountStatuses[key].accountBlocked);

  if (!accountNames) { return []; }

  const allPartitionsSet = new Set<string>();

  for (const accountName of accountNames) {
    const availablePartitions = await asyncClientCall(client, "getAvailablePartitions",
      { cluster: cluster, accountName: accountName, userId: user.identityId }).then((resp) => {
      return resp.partitions;
    });
    availablePartitions.forEach((partition) => {
      // 利用new Set()对对象数组转化后的字符串去重
      const partitionStr = JSON.stringify(partition);
      allPartitionsSet.add(partitionStr);
    });
  }

  return Array.from(allPartitionsSet).map((partition) => JSON.parse(partition) as Partition);
};

export async function getBillingTableItems(tenantName: string | undefined, user?: UserInfo | undefined) {
  const items = (await getBillingItems(tenantName, true)).activeItems;

  const pathItemMap = items.reduce((prev, curr) => {
    prev[curr.path] = curr;
    return prev;
  }, {} as Record<string, JobBillingItem>);

  let count = 0;
  const tableItems: JobBillingTableItem[] = [];
  const clusters = runtimeConfig.CLUSTERS_CONFIG;

  const client = getClient(ConfigServiceClient);

  for (const [cluster] of Object.entries(clusters)) {

    const partitions = user ? await getAvailablePartitionForItems(client, cluster, user)
      : await asyncClientCall(client, "getClusterConfig", { cluster }).then((resp) => resp.partitions);

    const partitionCount = partitions.length;
    let clusterItemIndex = 0;
    for (const partition of partitions) {
      const qosCount = partition.qos?.length ?? 1;
      let partitionItemIndex = 0;
      for (const qos of partition.qos ?? [""]) {

        const path = [cluster, partition.name, qos].filter((x) => x).join(".");

        const item = pathItemMap[path];

        tableItems.push({
          index: count++,
          clusterItemIndex: clusterItemIndex++,
          partitionItemIndex: partitionItemIndex++,
          cluster: publicConfig.CLUSTERS[cluster]?.name ?? cluster,
          cores: partition.cores,
          gpus: partition.gpus,
          mem: partition.memMb,
          nodes: partition.nodes,
          partition: partition.name,
          partitionCount,
          qosCount,
          qos,
          priceItem: item ? {
            amount: item.amountStrategy,
            itemId: item.id,
            price: moneyToString(item.price!),
          } : undefined,
          path,
          comment: partition.comment,
        });
      }
    }
  }

  return tableItems;

}

export default /* #__PURE__*/typeboxRoute(GetBillingTableSchema, async (req, res) => {
  const { tenant } = req.query;

  if (tenant) {
    const auth = authenticate((u) => u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN) || (u.tenant === tenant));
    const info = await auth(req, res);
    if (!info) { return; }
  }

  const items = await getBillingTableItems(tenant);

  return { 200: { items } };
});
