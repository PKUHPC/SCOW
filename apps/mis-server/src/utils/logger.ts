/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import pino from "pino";
import { config } from "src/config/env";

dayjs.extend(timezone);
dayjs.extend(utc);

export const loggerOptions: pino.LoggerOptions = {
  level: config.LOG_LEVEL,
  timestamp: () => `,"time":"${dayjs().tz("Asia/Shanghai").format("YYYY-MM-DD HH:mm:ss")}"`,
  ...config.LOG_PRETTY ? {
    transport: { target: "pino-pretty" },
  } : {},
};

export const logger = pino(loggerOptions);
