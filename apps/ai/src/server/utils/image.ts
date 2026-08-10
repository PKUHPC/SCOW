import { TRPCError } from "@trpc/server";
import { Logger } from "ts-log";

import { getHarborConfig, HarborClient, harborUrl } from "./harbor";

export { isValidImageAddress } from "src/utils/imageAddress";

const LOADED_IMAGE_REGEX = "Loaded image: ([\\w./-]+(?::[\\w.-]+)?)";

export const loadedImageRegex = new RegExp(LOADED_IMAGE_REGEX);

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

// 把字节转 GB，保留 2 位
export const bytesToGB = (n: number) => +(n / 1024 ** 3).toFixed(2);
