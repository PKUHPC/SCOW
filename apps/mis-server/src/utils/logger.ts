import pino from "pino";
import { config } from "src/config/env";

export const loggerOptions: pino.LoggerOptions = {
  level: config.LOG_LEVEL,
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(config.LOG_PRETTY
    ? {
        transport: { target: "pino-pretty" },
      }
    : {}),
};

export const logger = pino(loggerOptions);
