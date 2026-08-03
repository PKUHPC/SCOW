import { TRPCError } from "@trpc/server";
import { NextApiResponse } from "next";
import { NextResponse } from "next/server";
import { clusters } from "src/server/config/clusters";
import { FileMeta, ListDirectoryOutput } from "src/server/trpc/model/file";
import { clusterBackendNotSupported } from "src/server/utils/errors";
import { Logger } from "ts-log";

import { ScowdFileDriver } from "./scowdFileDriver";

export type callback = () => void;
export type shareOkCallback = (fullPath: string) => void;

export const SHARED_DIR = "/.shared";

// 分享文件的公共路径前缀
export enum SHARED_TARGET {
  DATASET = "/dataset",
  ALGORITHM = "/algorithm",
  MODEL = "/model",
}

export interface ShareParams {
  // 分享源绝对路径
  sourceFilePath: string;
  // 分享的类别目录：/dataset, /algorithm, /model
  sharedTarget: SHARED_TARGET;
  // 分享的目标名称：数据集，算法，模型的名称
  targetName: string;
  // 分享的目标子级名称：数据集版本，算法版本，模型版本的名称
  targetSubName: string;
  // 默认是用户家目录/nfs/home/{userId}的上上级目录/nfs，配置了sharedTopDir则直接使用
  sharedTopDir: string;
}

export interface FileDriver {
  deleteFile(path: string, noCheckPermission?: boolean): Promise<void>;
  deleteDir(path: string, noCheckPermission?: boolean): Promise<void>;
  copy(fromPath: string, toPath: string, noCheckPermission?: boolean): Promise<void>;
  copyWithMode(fromPath: string, toPath: string, mode: string, noCheckPermission?: boolean): Promise<void>;
  createFile(path: string, noCheckPermission?: boolean): Promise<void>;
  getHomeDirectory(): Promise<string>;
  makeDirectory(path: string, noCheckPermission?: boolean): Promise<void>;
  move(fromPath: string, toPath: string, noCheckPermission?: boolean): Promise<void>;
  readDirectory(path: string, noCheckPermission?: boolean): Promise<ListDirectoryOutput[]>;
  download(path: string, download: string, res: NextApiResponse<any>, noCheckPermission?: boolean): Promise<void>;
  upload(
    path: string,
    uploadedFile: File,
    chunkIdx?: number,
    noCheckPermission?: boolean,
  ): Promise<NextResponse<{ message: string }>>;
  getFileMetadata(path: string, noCheckPermission?: boolean): Promise<FileMeta>;
  exists(path: string, noCheckPermission?: boolean): Promise<boolean>;
  chmod(path: string, mode: string): Promise<void>;
  decompressFile(filePath: string, decompressionPath: string, noCheckPermission?: boolean): Promise<void>;
  compressFiles(paths: string[], archivePath: string, noCheckPermission?: boolean): Promise<void>;

  /**
   * 取消分享时删除相应的文件夹
   * @param sharedPath 需要取消分享的已分享主表绝对路径或子表绝对路径
   */
  unShareFileOrDir(sharedPath: string, successCallback?: callback, failureCallback?: callback): Promise<void>;

  shareFileOrDir(
    shareParams: ShareParams,
    successCallback?: shareOkCallback,
    failureCallback?: callback,
  ): Promise<void>;

  /**
   *
   * @param newName 变更后的名称
   * @param oldPath 需要变更的原主表绝对路径或者原子表绝对路径
   *
   */
  getUpdatedSharedPath(newName: string, oldPath: string): Promise<string>;

  checkCopyFilePath(toPath: string, fileName: string): Promise<void>;
  checkCreateResourcePath(toPath: string, noCheckPermission?: boolean): Promise<void>;
  checkSharePermission(sourcePath: string, noCheckPermission?: boolean): Promise<void>;
}

interface FileDriverProvider {
  supports(clusterId: string): boolean;
  create(opts: { clusterId: string; userId: string; logger: Logger }): FileDriver;
}

const fileDriverProviders: FileDriverProvider[] = [
  {
    supports: (clusterId) => clusters[clusterId]?.scowd?.enabled === true,
    create: ({ clusterId, userId, logger }) => new ScowdFileDriver(clusterId, userId, logger),
  },
];

function createFileDriver(opts: { clusterId: string; userId: string; logger: Logger }): FileDriver {
  const { clusterId, userId, logger } = opts;
  const cluster = clusters[clusterId];

  if (!cluster) {
    throw new TRPCError({ code: "NOT_FOUND", message: "cluster is not found" });
  }

  const provider = fileDriverProviders.find((provider) => provider.supports(clusterId));

  if (!provider) {
    throw clusterBackendNotSupported(clusterId);
  }

  return provider.create({ clusterId, userId, logger });
}

export async function withFileDriver<T>(
  params: {
    clusterId: string;
    user: string;
  },
  handler: (driver: FileDriver) => Promise<T>,
  logger: Logger,
) {
  const driver = createFileDriver({
    clusterId: params.clusterId,
    userId: params.user,
    logger,
  });

  try {
    return await handler(driver);
  } catch (err: any) {
    logger.error("Error in file operation, executing handler", err.message);
    throw err;
  }
}
