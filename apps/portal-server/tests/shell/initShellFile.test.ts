import { sftpExists, sftpStat, sshConnect } from "@scow/lib-ssh";
import { rootKeyPair } from "src/config/env";
import { initShellFile } from "src/utils/shell";
import { getClusterLoginNode } from "src/utils/ssh";

const SHELL_FILE_REMOTE = "/etc/profile.d/scow-shell-file.sh";

it("To test whether the scow-shell-file.sh is automatically copied", async () => {
  const cluster = "hpc01";

  await initShellFile(cluster, console);
  const host = getClusterLoginNode(cluster);
  if (!host) {
    throw new Error(`Cluster ${cluster} has no login node`);
  }

  await sshConnect(host, "test", rootKeyPair, console, async (ssh) => {
    const sftp = await ssh.requestSFTP();
    const result = await sftpExists(sftp, SHELL_FILE_REMOTE);
    expect(result).toEqual(true);
    const stats = await sftpStat(sftp)(SHELL_FILE_REMOTE);
    const testNumberPermission = (stats.mode & parseInt("777", 8)).toString(8);
    expect(testNumberPermission).toEqual("755");
  });
});
