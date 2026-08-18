import { runComposeCommand } from "src/compose/cmd";
import { getInstallConfig } from "src/config/install";

interface Options {
  configPath: string;
}

export const enterDb = async (options: Options) => {
  const config = getInstallConfig(options.configPath);

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
