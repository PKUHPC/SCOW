import { TRPCError } from "@trpc/server";
import { NextApiResponse } from "next";
import { NextResponse } from "next/server";
import { clusters } from "src/server/config/clusters";
import { clusterNotFound } from "src/server/utils/errors";
import { getClusterLoginNode } from "src/server/utils/ssh";
import { Logger } from "ts-log";

import { FileMeta, ListDirectoryOutput } from "../model/file";
import { ScowdFileDriver } from "./scowdFileDriver";
import { SshFileDriver } from "./sshFileDriver";

export interface FileDriver {
  deleteFile(path: string): Promise<void>;
  deleteDir(path: string): Promise<void>;
  copy(fromPath: string, toPath: string): Promise<void>;
  createFile(path: string): Promise<void>;
  getHomeDirectory(): Promise<string>;
  makeDirectory(path: string): Promise<void>;
  move(fromPath: string, toPath: string): Promise<void>;
  readDirectory(path: string): Promise<ListDirectoryOutput[]>;
  download(path: string,download: string,res: NextApiResponse<any>): Promise<void>;
  upload(path: string, uploadedFile: File): Promise<NextResponse<{ message: string; }>>;
  getFileMetadata(path: string): Promise<FileMeta>;
  exists(path: string): Promise<boolean>;

  decompressFile(filePath: string,decompressionPath: string): Promise<void>;
}

function createFileDriver(opts: {
  clusterId: string;
  userId: string;
  logger: Logger;
}): FileDriver {
  const { clusterId, userId, logger } = opts;
  const cluster = clusters[clusterId];
  const host = getClusterLoginNode(clusterId);

  if (!cluster) {
    throw new TRPCError({ code: "NOT_FOUND", message: "cluster is not found" });
  }

  if (!host) { throw clusterNotFound(clusterId); }

  if (cluster.scowd?.enabled) {
    return new ScowdFileDriver(clusterId, userId, logger);
  }

  return new SshFileDriver(host, userId, logger);
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
  } catch (err) {
    logger.error("Error in file operation, executing handler", err);
    throw err;
  }
}
