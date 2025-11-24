import { getResourceConfig, ResourceConfigSchema } from "@scow/config/build/resource";
import pino from "pino";

type ResourceLog = ResourceConfigSchema["log"];
// 定义并初始化默认值
let logConfig: ResourceLog = {
  level: "info",
  pretty: false,
};

try {
  const resourceConfig = getResourceConfig();
  if (resourceConfig?.log) {
    logConfig = resourceConfig.log;
  }
} catch {
  // 忽略错误：构建期间可能没有配置文件，使用上面的默认值即可
  // 只用于服务调用间部分logger.error展示
}

const loggerOptions: pino.LoggerOptions = {
  level: logConfig.level,
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(logConfig.pretty
    ? {
      transport: { target: "pino-pretty" },
    }
    : {}),
};

export const logger = pino(loggerOptions);
