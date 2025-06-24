// Declares all plugins in this file
// In my yaarxiv project, there can be multiple interface augmentations separated in difference files
// But in this project, only one augmentation is resolved.
// Don't know why.

import type { MikroORM } from "@mikro-orm/core";
import type { MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
import { Capabilities } from "@scow/lib-auth";
import { ScowResourcePlugin, scowResourcePlugin } from "@scow/lib-scow-resource";
import { apiAuthPlugin } from "@scow/lib-server";
import { commonConfig } from "src/config/common";
import { misConfig } from "src/config/mis";
import { authServicePlugin } from "src/plugins/authService";
import { billPlugin } from "src/plugins/bill";
import { ClearCachePlugin, clearCachePlugin } from "src/plugins/cachePlugin";
import { ClusterPlugin, clustersPlugin } from "src/plugins/clusters";
import { FetchPlugin, fetchPlugin } from "src/plugins/fetch";
import { ormPlugin } from "src/plugins/orm";
import { PricePlugin, pricePlugin } from "src/plugins/price";
import { StatisticPlugin, statisticPlugin } from "src/plugins/statistic";
import { SyncBlockStatusPlugin, syncBlockStatusPlugin } from "src/plugins/syncBlockStatus";

declare module "@ddadaal/tsgrpc-server" {
  interface Extensions extends ClusterPlugin, PricePlugin, FetchPlugin, StatisticPlugin,
    SyncBlockStatusPlugin, ScowResourcePlugin, ClearCachePlugin {
    orm: MikroORM<MySqlDriver>;
    capabilities: Capabilities;
  }

  interface Request {
    em: SqlEntityManager<MySqlDriver>;
  }
}

export const plugins = [
  ormPlugin,
  clustersPlugin,
  pricePlugin,
  fetchPlugin,
  statisticPlugin,
  authServicePlugin,
  clearCachePlugin,
];

if (commonConfig.scowResource?.enabled) {
  // 如果已部署资源管理服务，确保启动时注入顺序的先后，保证启动时如果开启账户同步获取到资源管理服务的数据
  plugins.push(scowResourcePlugin(commonConfig.scowResource));
  plugins.push(syncBlockStatusPlugin);
} else {
  plugins.push(syncBlockStatusPlugin);
}

if (commonConfig.scowApi) {
  plugins.push(apiAuthPlugin(commonConfig.scowApi));
}

if (misConfig.bill?.enabled) {
  plugins.push(billPlugin);
}

