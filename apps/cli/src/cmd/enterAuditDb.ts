import { runComposeCommand } from "src/compose/cmd";
import { getInstallConfig } from "src/config/install";

interface Options {
  configPath: string;
}

export const enterAuditDb = async (options: Options) => {
  const config = getInstallConfig(options.configPath);

  if (!config.audit) {
    throw new Error("audit is not deployed. db is not deployed");
  }

  await runComposeCommand(config, ["exec", "audit-db", "mysql", "-uroot", `-p'${config.audit.dbPassword}'`]);
};
