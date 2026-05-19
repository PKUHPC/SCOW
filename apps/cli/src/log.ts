import pino from "pino";
import pretty from "pino-pretty";
import { config } from "src/config/env";

const logPretty = pretty({
  include: ["level", config.LOG_SHOW_TIMESTAMP ? "time" : undefined, "msg"].filter((x) => x).join(","),
  sync: true,
});

export const logger = pino(
  {
    level: config.LOG_LEVEL,
  },
  logPretty,
);
