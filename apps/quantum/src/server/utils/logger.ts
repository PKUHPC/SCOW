import pino from "pino";

export const loggerOptions: pino.LoggerOptions = {
  level: "info",
  timestamp: pino.stdTimeFunctions.isoTime,
};

export const logger = pino(loggerOptions);
