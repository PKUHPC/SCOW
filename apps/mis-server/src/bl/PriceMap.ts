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
import { Logger } from "@ddadaal/tsgrpc-server";
import { MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
import { Partition } from "@scow/scheduler-adapter-protos/build/config";
import { calculateJobPrice } from "src/bl/jobPrice";
import { misConfig } from "src/config/mis";
import { JobPriceInfo } from "src/entities/JobInfo";
import { AmountStrategy, JobPriceItem } from "src/entities/JobPriceItem";
import { ClusterPlugin } from "src/plugins/clusters";

import { getActivatedClusters } from "./clustersUtils";

export interface JobInfo {
  // cluster job id
  jobId: number;
  // scow cluster id
  cluster: string;
  partition: string;
  qos: string;
  timeUsed: number;
  cpusAlloc: number;
  gpu: number;
  memReq: number;
  memAlloc: number;
  account: string;
  tenant: string;
  submitTime: Date;
}

export interface PriceMap {
  // path: [cluster, partition, qos]
  getPriceItem(path: [string, string, string], submitTime: Date, tenantName?: string): JobPriceItem;
  getPriceMap(tenantName?: string): Record<string, JobPriceItem>;

  calculatePrice(info: JobInfo): Promise<JobPriceInfo>;

  getMissingDefaultPriceItems(): string[];
}

type PriceItemsByPath = Record<string, JobPriceItem[]>;
type TenantSpecificPriceItems = Record<string, PriceItemsByPath>;


export async function createPriceMap(
  em: SqlEntityManager<MySqlDriver>,
  clusterPlugin: ClusterPlugin["clusters"],
  logger: Logger,
): Promise<PriceMap> {
  // get all billing items
  // order by ASC so that items added later overrides items added before.
  const billingItems = await em.find(JobPriceItem, {}, {
    populate: ["tenant"],
    orderBy: { createTime: "ASC" },
  });

  const {
    defaultPrices,
    tenantSpecificPrices,
    defaultPricesHistory,
    tenantSpecificPricesHistory,
  } = getBillingItems(billingItems);

  logger.info("Default Price Map: %o", defaultPrices);
  logger.info("Tenant specific prices %o", tenantSpecificPrices);

  checkCustomAmountStrategy(defaultPrices, tenantSpecificPrices);

  const findPriceItemForPath = (
    items: PriceItemsByPath | undefined,
    pathKey: string,
    submitTime: Date,
  ): JobPriceItem | undefined => {
    if (!items) { return undefined; }
    const priceHistory = items[pathKey];
    if (!priceHistory || priceHistory.length === 0) { return undefined; }
    if (!submitTime) {
      return priceHistory[priceHistory.length - 1];
    }
    const submitTimestamp = submitTime.getTime();
    for (let i = priceHistory.length - 1; i >= 0; i--) {
      if (priceHistory[i].createTime.getTime() <= submitTimestamp) {
        return priceHistory[i];
      }
    }
    return undefined;
  };

  const getPriceItem = (path: [string, string, string], submitTime: Date, tenantName?: string) => {

    const [cluster, partition, qos] = path;
    const pathWithQos = [cluster, partition, qos].join(".");
    const pathWithoutQos = [cluster, partition].join(".");

    if (tenantName && tenantName in tenantSpecificPricesHistory) {
      const specific = findPriceItemForPath(tenantSpecificPricesHistory[tenantName], pathWithQos, submitTime) ||
        findPriceItemForPath(tenantSpecificPricesHistory[tenantName], pathWithoutQos, submitTime);

      if (specific) { return specific; }
    }

    const price = findPriceItemForPath(defaultPricesHistory, pathWithQos, submitTime) ||
      findPriceItemForPath(defaultPricesHistory, pathWithoutQos, submitTime);

    if (!price) {
      throw new Error(`Unknown cluster ${cluster} partition ${partition} qos ${qos}`);
    }

    return price;
  };



  // call for all activated clusters
  const activatedClusters = await getActivatedClusters(em, logger).catch((e) => {
    logger.info("!!![important] No available activated clusters.This will skip creating price map in cluster!!!");
    logger.info(e);
    return {};
  });

  // partitions info for activated clusters
  const partitionsForClusters: Record<string, Partition[]> = {};

  await Promise.allSettled(Object.keys(activatedClusters).map(async (cluster) => {
    try {
      const result = await clusterPlugin.callOnOne(
        cluster,
        logger,
        async (client) => await asyncClientCall(client.config, "getClusterConfig", {}),
      );
      partitionsForClusters[cluster] = result.partitions;
    } catch (error) {
      logger.info(`Can not get cluster's (clusterId: ${cluster}) config info from adapter.`, error);
    };
  }));

  return {

    calculatePrice: (info) => calculateJobPrice(partitionsForClusters, info, getPriceItem, logger),

    getMissingDefaultPriceItems: () => {

      const missingPaths = [] as string[];

      for (const cluster in activatedClusters) {

        if (!partitionsForClusters[cluster]) {
          logger.info(
            `Can not get missing default price items from partitions of cluster (clusterId: ${cluster}) currently.`);
          continue;
        }

        for (const partition of partitionsForClusters[cluster]) {
          const path = [cluster, partition.name];
          const { qos } = partition;

          if (path.join(".") in defaultPrices) {
            continue;
          }

          if (Array.isArray(qos)) {
            qos.forEach((q) => {
              const newPath = [...path, q].join(".");
              if (!(newPath in defaultPrices)) {
                missingPaths.push(newPath);
              }
            });
          } else {
            missingPaths.push(path.join("."));
          }
        }
      }

      return missingPaths;
    },

    getPriceMap: (tenantName) => {
      return {
        ...defaultPrices,
        ...(tenantName) ? tenantSpecificPrices[tenantName] : undefined,
      };
    },

    getPriceItem,
  };
}

export function getBillingItems(items: JobPriceItem[]) {
  const defaultPricesHistory: PriceItemsByPath = {};
  const tenantSpecificPricesHistory: TenantSpecificPriceItems = {};

  items.forEach((item) => {
    const pathKey = item.path.join(".");
    if (!item.tenant) {
      if (!defaultPricesHistory[pathKey]) {
        defaultPricesHistory[pathKey] = [];
      }
      defaultPricesHistory[pathKey].push(item);
    } else {
      const tenantName = item.tenant.getProperty("name");
      if (!(tenantName in tenantSpecificPricesHistory)) {
        tenantSpecificPricesHistory[tenantName] = {};
      }
      if (!(pathKey in tenantSpecificPricesHistory[tenantName])) {
        tenantSpecificPricesHistory[tenantName][pathKey] = [];
      }
      tenantSpecificPricesHistory[tenantName][pathKey].push(item);
    }
  });

  const buildLatestMap = (itemsByPath: PriceItemsByPath): Record<string, JobPriceItem> => {
    const result: Record<string, JobPriceItem> = {};
    Object.entries(itemsByPath).forEach(([pathKey, history]) => {
      if (history.length > 0) {
        result[pathKey] = history[history.length - 1];
      }
    });
    return result;
  };

  const defaultPrices = buildLatestMap(defaultPricesHistory);
  const tenantSpecificPrices: Record<string, Record<string, JobPriceItem>> = {};
  Object.entries(tenantSpecificPricesHistory).forEach(([tenant, priceHistory]) => {
    tenantSpecificPrices[tenant] = buildLatestMap(priceHistory);
  });

  return { defaultPrices, tenantSpecificPrices, defaultPricesHistory, tenantSpecificPricesHistory };
}

// 检查用户使用的自定义计费id是否还存在配置文件中，对应的js文件是否能正常加载，如果不能，抛出异常并停止服务
export function checkCustomAmountStrategy(defaultPrices: Record<string, JobPriceItem>,
  tenantSpecificPrices: Record<string, Record<string, JobPriceItem>>) {

  let activeCustomAmountStrategyNames: string[] = [];
  const amountStrategies: string[] = Object.values(AmountStrategy);

  // 统计平台使用中的自定义计费项
  for (const priceItem of Object.values(defaultPrices)) {
    if (!amountStrategies.includes(priceItem.amount)) {
      activeCustomAmountStrategyNames.push(priceItem.amount);
    }
  }

  // 统计各租户使用中的自定义计费项
  for (const tenantPricesItem of Object.values(tenantSpecificPrices)) {
    for (const priceItem of Object.values(tenantPricesItem)) {
      if (!amountStrategies.includes(priceItem.amount)) {
        activeCustomAmountStrategyNames.push(priceItem.amount);
      }
    }
  }

  // 无使用中的自定义计费项，直接返回
  if (!activeCustomAmountStrategyNames.length) {
    return;
  }

  activeCustomAmountStrategyNames = Array.from(new Set(activeCustomAmountStrategyNames));

  if (Array.isArray(misConfig.customAmountStrategies)) {
    const customAmountStrategyNames = misConfig.customAmountStrategies.map((i) => i.id);
    // 如有任意一个使用中的自定义计费id不在配置中，也将直接抛出错误
    if (activeCustomAmountStrategyNames.every((i) => customAmountStrategyNames.includes(i))) {
      return;
    }
  }

  throw new Error(`Some custom strategies are not found : ${activeCustomAmountStrategyNames.join()}`);
}
