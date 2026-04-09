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

import { runComposeCommand } from "src/compose/cmd";
import { getInstallConfig } from "src/config/install";

interface Options {
  configPath: string;
}

export const enterDb = async (options: Options) => {
  const config = getInstallConfig(options.configPath);

  if (!config.mis) {
    throw new Error("MIS is not deployed. db is not deployed");
  }

  await runComposeCommand(config, [
    "exec",
    "-e",
    "LANG=C.UTF-8",
    "-e",
    `MYSQL_PWD='${config.mis.dbPassword}'`,
    "db",
    "mysql",
    "-uroot",
  ]);
};
