import { sftpChmod } from "@scow/lib-ssh";
import { getConfigClusterLoginNode, sshConnect } from "src/utils/ssh";
import { Logger } from "ts-log";

const SHELL_FILE_LOCAL = "assets/scow-shell-file.sh";
const PROFILE_DIRECTORY = "/etc/profile.d";
const SHELL_FILE_REMOTE = "/etc/profile.d/scow-shell-file.sh";

export async function initShellFile(cluster: string, logger: Logger) {
  const host = getConfigClusterLoginNode(cluster);
  if (!host) {
    throw new Error(`Cluster ${cluster} has no login node`);
  }

  return await sshConnect(host, "root", logger, async (ssh) => {
    // make sure directory /etc/profile.d exists.
    await ssh.mkdir(PROFILE_DIRECTORY);
    const sftp = await ssh.requestSFTP();

    await ssh.putFile(SHELL_FILE_LOCAL, SHELL_FILE_REMOTE);
    await sftpChmod(sftp)(SHELL_FILE_REMOTE, "755");
    logger.info(`Copy scow-shell-file.sh to the ${SHELL_FILE_REMOTE} of the login node of cluster ${cluster}.`);
  });
}
