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

import { loggedExec } from "@scow/lib-ssh";
import { TRPCError } from "@trpc/server";
import { NodeSSH } from "node-ssh";
import { Logger } from "ts-log";

import { clusters } from "../config/clusters";
import { getHarborConfig, HarborClient, harborPassword, harborUrl, harborUser } from "./harbor";

const LOADED_IMAGE_REGEX = "Loaded image: ([\\w./-]+(?::[\\w.-]+)?)";

export const loadedImageRegex = new RegExp(LOADED_IMAGE_REGEX);

export function getUserHarborProjectName(userId: string) {
  return `u_${userId}`;
}

// 创建要上传到harbor的镜像地址
export async function createHarborImageUrl(imageName: string, imageTag: string,
  userId: string,logger: Logger): Promise<string> {
  const projectName = getUserHarborProjectName(userId);

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
          message: `Failed to create project ${projectName} ⇒ ${createRes.status} ${msg}`,
        });
      }
      logger.info(`Project created: ${projectName}`);

      return `${harborUrl}/${projectName}/${imageName}:${imageTag}`;
    }

    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Failed to check/create project ${projectName} ⇒ ${e.message}`,
    });
  }
};

export enum k8sRuntime {
  docker = "docker",
  containerd = "containerd",
}

const runtimeCommands = {
  [k8sRuntime.docker]: "docker",
  // -n namespace，k8s集群相关的容器命令必须加上该参数才有对应数据
  [k8sRuntime.containerd]: "nerdctl -n k8s.io",
};

const runtimeContainerIdPrefix = {
  [k8sRuntime.docker]: "docker",
  [k8sRuntime.containerd]: "containerd",
};

export function getK8sRuntime(clusterId: string): k8sRuntime {
  const runtime = clusters[clusterId].k8s?.runtime;
  return runtime ?? k8sRuntime.docker;
}

export function getRuntimeCommand(runtime: k8sRuntime): string {
  return runtimeCommands[runtime];
}

function getContainerIdPrefix(runtime: k8sRuntime): string {
  return runtimeContainerIdPrefix[runtime];
}

// 加载本地镜像
export async function getLoadedImage({
  ssh,
  logger,
  sourcePath,
  clusterId,
}: {
  ssh: NodeSSH,
  logger: Logger,
  sourcePath: string,
  clusterId: string,
}): Promise<string | undefined> {

  const runtime = getK8sRuntime(clusterId);
  const command = getRuntimeCommand(runtime);

  const loadedResp = await loggedExec(ssh, logger, true, command, ["load", "-i", sourcePath]);
  const match = loadedImageRegex.exec(loadedResp.stdout);
  return match && match.length > 1 ? match[1] : undefined;
}


export interface LoginInfo {
  userName?: string,
  password?: string,
}
// 拉取远程镜像
export async function getPulledImage({
  ssh,
  logger,
  sourcePath,
  clusterId,
  loginInfo,
}: {
  ssh: NodeSSH,
  logger: Logger,
  sourcePath: string,
  clusterId: string,
  loginInfo?: LoginInfo,
}): Promise<string | undefined> {

  const runtime = getK8sRuntime(clusterId);
  const command = getRuntimeCommand(runtime);

  const { userName, password } = loginInfo ?? {};
  let isLoggedIn = false;

  const registryMirror = sourcePath.split("/")[0];
  if (userName && password) {
    try {
      await loggedExec(ssh, logger, true, command, ["login", registryMirror, "-u", userName, "-p", password]);
      isLoggedIn = true;
    } catch (error: any) {
      logger.error(`Login ${registryMirror} failed: ${error}`);
    }
  }

  const pulledResp = await loggedExec(ssh, logger, true, command, ["pull", sourcePath]);

  if (isLoggedIn) {
    await loggedExec(ssh, logger, true, command, ["logout", registryMirror]);
  }

  return pulledResp ? sourcePath : undefined;
}

// 上传镜像至harbor
export async function pushImageToHarbor({
  ssh,
  logger,
  localImageUrl,
  harborImageUrl,
  clusterId,
}: {
  ssh: NodeSSH,
  logger: Logger,
  localImageUrl: string,
  harborImageUrl: string,
  clusterId: string,
}): Promise<void> {

  const runtime = getK8sRuntime(clusterId);
  const command = getRuntimeCommand(runtime);

  // login harbor
  await loggedExec(ssh, logger, true, command, ["login", harborUrl, "-u", harborUser, "-p", harborPassword]);

  // tag
  await loggedExec(ssh, logger, true, command, ["tag", localImageUrl, harborImageUrl]);

  // push 镜像至harbor
  await loggedExec(ssh, logger, true, command, ["push", harborImageUrl])
    .catch(async (e) => {

      logger.error(e, "Can not push image to the external repository. "
        + "Please verify if the image list includes unnecessary multi-platform image data.");
      // 为了避免可能由于错误镜像缓存引起的问题，清除localImage,taggedImage
      logger.info("Deleting the locally pulled image and the tagged image ...");
      await loggedExec(ssh, logger, true, command, ["rmi", localImageUrl]);
      await loggedExec(ssh, logger, true, command, ["rmi", harborImageUrl]);
      throw new TRPCError({
        code: "CONFLICT",
        message: `Can not push image to the external repository. : ${e}`,
      });
    }); ;

  // 清除本地镜像
  await loggedExec(ssh, logger, true, command, ["rmi", harborImageUrl]);
  await loggedExec(ssh, logger, true, command, ["rmi", localImageUrl]);
}

// commit制作本地镜像
export async function commitContainerImage({
  node,
  ssh,
  logger,
  formattedContainerId,
  localImageUrl,
  clusterId,
}: {
  node: string,
  ssh: NodeSSH,
  logger: Logger,
  formattedContainerId: string,
  localImageUrl: string,
  clusterId: string,
}): Promise<void> {

  const runtime = getK8sRuntime(clusterId);
  const command = getRuntimeCommand(runtime);
  const resp = await loggedExec(ssh, logger, true, "sh",
    ["-c", `${command} ps --no-trunc | grep ${formattedContainerId}`]);
  if (!resp.stdout) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Can not find the container: ${formattedContainerId} in node ${node}`,
    });
  }

  // commit镜像
  await loggedExec(ssh, logger, true, command,
    ["commit", formattedContainerId, localImageUrl]);
}


export const formatContainerId = (clusterId: string, containerId: string) => {
  const runtime = getK8sRuntime(clusterId);
  const prefix = getContainerIdPrefix(runtime);
  return containerId.replace(`${prefix}://`, "");
};


export function isValidImageAddress(imageAddress: string) {
  const ImageAddressRegex = new RegExp(
    "^(?:[a-zA-Z0-9.-]+(?::\\d+)?\\/)?" + // 可选的 registry（如 docker.io, myregistry.com:5000）
    "[a-z0-9._-]+(?:\\/[a-z0-9._-]+)*" + // 镜像名称（支持多级路径）
    "(?::[a-zA-Z0-9._-]+|@sha256:[a-fA-F0-9]{64})?$", // 可选的 tag 或 sha256 digest
  );
  return ImageAddressRegex.test(imageAddress);
}

// 把字节转 GB，保留 2 位
export const bytesToGB = (n: number) => +(n / (1024 ** 3)).toFixed(2);
