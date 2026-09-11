// Declares all plugins in this file
// In my yaarxiv project, there can be multiple interface augmentations separated in difference files
// But in this project, only one augmentation is resolved.
// Don't know why.

import type { MikroORM } from "@mikro-orm/core";
import type { MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";

import { Capabilities } from "@scow/lib-auth";
import { ScowResourcePlugin, scowResourcePlugin } from "@scow/lib-scow-resource";
import { apiAuthPlugin, requestLogContextPlugin } from "@scow/lib-server";
import { commonConfig } from "src/config/common";
import { misConfig } from "src/config/mis";
import { authServicePlugin } from "src/plugins/authService";
import { billPlugin } from "src/plugins/bill";
import { ClearCachePlugin, clearCachePlugin } from "src/plugins/cachePlugin";
import { CleanExpiredWhitelistsPlugin } from "src/plugins/cleanExpiredWhitelists";
import { ClusterPlugin, clustersPlugin } from "src/plugins/clusters";
import { FetchPlugin, fetchPlugin } from "src/plugins/fetch";
import { ormPlugin } from "src/plugins/orm";
import { PricePlugin, pricePlugin } from "src/plugins/price";
import { StatisticPlugin, statisticPlugin } from "src/plugins/statistic";
import { StorageBillingPlugin, storageBillingPlugin } from "src/plugins/storageBilling";
import { SyncBlockStatusPlugin, syncBlockStatusPlugin } from "src/plugins/syncBlockStatus";
import { SyncAccountStorageDataPlugin } from "src/plugins/syncAccountStorageData";
import { SyncStorageDataPlugin } from "src/plugins/syncStorageData";

declare module "@ddadaal/tsgrpc-server" {
  interface Extensions
    extends
      ClusterPlugin,
      PricePlugin,
      FetchPlugin,
      StatisticPlugin,
      SyncBlockStatusPlugin,
      ScowResourcePlugin,
      ClearCachePlugin,
      StorageBillingPlugin,
      SyncStorageDataPlugin,
      SyncAccountStorageDataPlugin {
    orm: MikroORM<MySqlDriver>;
    capabilities: Capabilities;
  }

  interface Request {
    em: SqlEntityManager<MySqlDriver>;
  }
}

export const plugins = [
  requestLogContextPlugin,
  ormPlugin,
  clustersPlugin,
  pricePlugin,
  fetchPlugin,
  statisticPlugin,
  authServicePlugin,
  clearCachePlugin,
  SyncStorageDataPlugin,
  SyncAccountStorageDataPlugin,
  CleanExpiredWhitelistsPlugin,
];

// 确保资源管理插件先于依赖它的同步任务注入。
plugins.push(scowResourcePlugin(commonConfig.scowResource));
plugins.push(syncBlockStatusPlugin);

plugins.push(apiAuthPlugin(commonConfig.scowApi));

if (misConfig.bill?.enabled) {
  plugins.push(billPlugin);
}

if (misConfig.storageBilling?.enabled) {
  plugins.push(storageBillingPlugin);
}
