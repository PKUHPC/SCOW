import { authPlugin } from "src/plugins/auth";
import { gracefulShutdownPlugin } from "src/plugins/gracefulShutdown";
import { redisPlugin } from "src/plugins/redis";
import { staticPlugin } from "src/plugins/static";
import { viewPlugin } from "src/plugins/view";

export const plugins = [redisPlugin, authPlugin, staticPlugin, gracefulShutdownPlugin, viewPlugin];
