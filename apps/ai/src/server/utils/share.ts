import { sftpExists, sftpStat } from "@scow/lib-ssh";
import { TRPCError } from "@trpc/server";
import { NodeSSH } from "node-ssh";
import { Logger } from "ts-log";

export const SHARED_DIR = "/.shared";

// 分享文件的公共路径前缀，也适用于公共数据集的公共路径
export enum SHARED_TARGET {
  DATASET = "/dataset",
  ALGORITHM = "/algorithm",
  MODEL = "/model",
}

// 检查当前用户否具有分享权限
export async function checkSharePermission({
  ssh,
  logger,
  sourcePath,
  userId,
}: {
  ssh: NodeSSH;
  logger: Logger;
  sourcePath: string;
  userId: string;
}): Promise<void> {
  const sftp = await ssh.requestSFTP();

  const sourceFileExists = await sftpExists(sftp, sourcePath);
  // 分享时判断源文件是否存在
  if (!sourceFileExists) {
    throw new TRPCError({ code: "NOT_FOUND", message: `${sourcePath} is not found` });
  }

  // 判断是否具有拥有者访问权限
  await sftpStat(sftp)(sourcePath).catch((e) => {
    logger.error(e, "stat %s as %s failed", sourcePath, userId);
    throw new TRPCError({ code: "FORBIDDEN", message: `${sourcePath} is not accessible` });
  });
}
