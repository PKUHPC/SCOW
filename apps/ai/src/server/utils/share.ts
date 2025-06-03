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

import { sftpExists, sftpStat } from "@scow/lib-ssh";
import { TRPCError } from "@trpc/server";
import { NodeSSH } from "node-ssh";
import { Logger } from "ts-log";

export const SHARED_DIR = "/.shared";

// 分享文件的公共路径前缀
export enum SHARED_TARGET {
  DATASET = "/dataset",
  ALGORITHM = "/algorithm",
  MODEL = "/model",
};

// 检查当前用户否具有分享权限
export async function checkSharePermission({
  ssh,
  logger,
  sourcePath,
  userId,
}: {
  ssh: NodeSSH,
  logger: Logger,
  sourcePath: string,
  userId: string,
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

