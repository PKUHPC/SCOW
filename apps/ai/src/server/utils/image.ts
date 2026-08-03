import { TRPCError } from "@trpc/server";
import { Logger } from "ts-log";

import { getHarborConfig, HarborClient, harborUrl } from "./harbor";

export function getUserHarborProjectName(userId: string, isPlatformOwned?: boolean) {
  return isPlatformOwned ? "admin_public_asset" : `u_${userId}`;
}

// 创建要上传到harbor的镜像地址
export async function createHarborImageUrl(
  imageName: string,
  imageTag: string,
  userId: string,
  logger: Logger,
  isPlatformOwned?: boolean,
): Promise<string> {
  const projectName = getUserHarborProjectName(userId, isPlatformOwned);

  const harborConfig = getHarborConfig();
  const harbor = new HarborClient(harborConfig);

  try {
    await harbor.getProjectInfo(projectName);

    return `${harborUrl}/${projectName}/${imageName}:${imageTag}`;
  } catch (e: any) {
    if (e.message.includes("404")) {
      // 项目不存在 ⇒ 创建
      const createRes = await harbor.createProject(projectName);

      if (!createRes.ok) {
        const msg = await createRes.text();
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Failed to create project ${projectName} => ${createRes.status} ${msg}`,
        });
      }
      logger.info(`Project created: ${projectName}`);

      return `${harborUrl}/${projectName}/${imageName}:${imageTag}`;
    }

    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Failed to check/create project ${projectName} => ${e.message}`,
    });
  }
}

export interface LoginInfo {
  userName?: string;
  password?: string;
}

export function isValidImageAddress(imageAddress: string) {
  const ImageAddressRegex = new RegExp(
    "^(?:[a-zA-Z0-9.-]+(?::\\d+)?\\/)?" + // 可选的 registry（如 docker.io, myregistry.com:5000）
      "[a-z0-9._-]+(?:\\/[a-z0-9._-]+)*" + // 镜像名称（支持多级路径）
      "(?::[a-zA-Z0-9._-]+|@sha256:[a-fA-F0-9]{64})?$", // 可选的 tag 或 sha256 digest
  );
  return ImageAddressRegex.test(imageAddress);
}

// 把字节转 GB，保留 2 位
export const bytesToGB = (n: number) => +(n / 1024 ** 3).toFixed(2);
