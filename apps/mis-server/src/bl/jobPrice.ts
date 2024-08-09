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

import { Logger } from "@ddadaal/tsgrpc-server";
import { DEFAULT_CONFIG_BASE_PATH } from "@scow/config/build/constants";
import { Decimal } from "@scow/lib-decimal";
import { Partition } from "@scow/scheduler-adapter-protos/build/protos/config";
import { join } from "path";
import { JobInfo, PriceMap } from "src/bl/PriceMap";
import { configClusters } from "src/config/clusters";
import { misConfig } from "src/config/mis";
import { JobPriceInfo } from "src/entities/JobInfo";
import { AmountStrategy, JobPriceItem } from "src/entities/JobPriceItem";


type AmountStrategyFunc = (info: JobInfo, partition: Partition) => Decimal;
type CustomAmountStrategyFunc = (info: JobInfo) => number;

const customAmountStrategyFuncs: Record<string, CustomAmountStrategyFunc> = {};

if (Array.isArray(misConfig.customAmountStrategies)) {
  for (const item of misConfig.customAmountStrategies) {
    // 这里不try catch，如有错误，抛出错误并中止服务
    customAmountStrategyFuncs[item.id] = require(join(DEFAULT_CONFIG_BASE_PATH, "scripts", item.script));
    if (typeof customAmountStrategyFuncs[item.id] !== "function") {
      throw new Error(`Custom strategy with id ${item.id} is not a function`);
    }
  }
}

const amountStrategyFuncs: Record<AmountStrategy, AmountStrategyFunc> = {
  [AmountStrategy.GPU]: (info) => new Decimal(info.gpu),
  [AmountStrategy.CPUS_ALLOC]: (info) => new Decimal(info.cpusAlloc),
  [AmountStrategy.MAX_GPU_CPUSALLOC]: (info, partition) => {
    const { gpu, cpusAlloc } = info;
    const { cores, gpus } = partition;
    return Decimal.max(
      gpu,
      new Decimal(cpusAlloc).div(
        new Decimal(cores).div(gpus),
      ).integerValue(Decimal.ROUND_CEIL),
    );
  },
  [AmountStrategy.MAX_CPUSALLOC_MEM]: (info, partition) => {

    const { memMb, cores } = partition;
    return Decimal.max(
      // 核心数
      info.cpusAlloc,

      // 申请内存总数/(分区内容/分区核心数)
      new Decimal(info.memReq).div(
        new Decimal(memMb).div(cores),
      ).integerValue(Decimal.ROUND_CEIL),
    );
  },

};


export async function calculateJobPrice(
  partitionsForClusters: Record<string, Partition[]>,
  info: JobInfo, getPriceItem: PriceMap["getPriceItem"],
  logger: Logger): Promise<JobPriceInfo> {

  logger.trace(`Calculating price for job ${info.jobId} in cluster ${info.cluster}`);

  // use all clusters from config files
  const clusters = configClusters;
  const clusterInfo = clusters[info.cluster];

  if (!clusterInfo) {
    logger.warn(`Unknown cluster ${info.cluster}`);
    return emptyJobPriceInfo();
  }

  const partitionInfo = partitionsForClusters[info.cluster].find((x) => x.name === info.partition);
  if (!partitionInfo) {
    logger.warn(`Unknown partition ${info.partition} of cluster ${info.cluster}`);
    return emptyJobPriceInfo();
  }

  const path = [info.cluster, info.partition, info.qos] as [string, string, string];

  async function calculatePrice(priceItem: JobPriceItem, partition: Partition) {
    const time = new Decimal(info.timeUsed).div(3600); // 秒到小时

    const amountFn = amountStrategyFuncs[priceItem.amount] || customAmountStrategyFuncs[priceItem.amount];

    let amount = amountFn ? await amountFn(info, partition) : new Decimal(0);

    if (!amountFn || isNaN(amount)) {
      logger.warn("Unknown AmountStrategy %s. Count as 0. Please checkout your custom strategy", priceItem.amount);
    }

    // 对于自定义收费策略返回的值，需要进行类型转换
    amount = new Decimal(amount);

    amount = amount.multipliedBy(time);

    amount = amount.decimalPlaces(misConfig.chargePrecision, Decimal.ROUND_DOWN);

    // 如果单价大于0，且运行时间大于0，若结果算下来金额为0，按照最低费用计算价格
    if (priceItem.price.gt(0) && time.gt(0)) {
      if (priceItem.price.multipliedBy(amount).gt(misConfig.minChargeAmount)) {
        return priceItem.price.multipliedBy(amount).decimalPlaces(misConfig.chargePrecision, Decimal.ROUND_HALF_CEIL);
      }
      // 防止出现精度为2时最小金额设置为0.001的情况，导致生成的费用精度不对
      return new Decimal(misConfig.minChargeAmount).decimalPlaces(misConfig.chargePrecision, Decimal.ROUND_HALF_CEIL);
    }

    return new Decimal(0);
  }
  const accountBase = getPriceItem(path, info.tenant);
  const tenantBase = getPriceItem(path);

  const accountPrice = await calculatePrice(accountBase, partitionInfo);
  const tenantPrice = await calculatePrice(tenantBase, partitionInfo);

  return {
    tenant: { billingItemId: tenantBase.itemId, price: tenantPrice },
    account: { billingItemId: accountBase.itemId, price: accountPrice },
  };
}

export const emptyJobPriceInfo = (): JobPriceInfo => ({ tenant: undefined, account: undefined });
