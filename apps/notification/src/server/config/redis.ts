import { RedisOptions } from "ioredis";

import { notificationConfig } from "./notification";

function getRedisOptions(): RedisOptions | undefined {
  if (!notificationConfig.redis) return undefined;

  const { host, port, password } = notificationConfig.redis;

  return {
    host,
    port,
    password,
  };
}

export const redisOptions: RedisOptions | undefined = getRedisOptions();
