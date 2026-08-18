import { Plugin } from "@ddadaal/tsgrpc-server";
import { ScowResourcePlugin, scowResourcePlugin } from "@scow/lib-scow-resource";
import { apiAuthPlugin, requestLogContextPlugin } from "@scow/lib-server";
import { commonConfig } from "src/config/common";

declare module "@ddadaal/tsgrpc-server" {
  interface Extensions extends ScowResourcePlugin {}
}

export const plugins = [requestLogContextPlugin] as Plugin[];

plugins.push(apiAuthPlugin(commonConfig.scowApi));
plugins.push(scowResourcePlugin(commonConfig.scowResource));
