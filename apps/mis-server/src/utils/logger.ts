import { createLoggerOptions } from "@scow/lib-server";
import pino from "pino";
import { config } from "src/config/env";

export const loggerOptions = createLoggerOptions(config);

export const logger = pino(loggerOptions);
