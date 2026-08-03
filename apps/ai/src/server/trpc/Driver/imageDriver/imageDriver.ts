import { TRPCError } from "@trpc/server";
import { clusters } from "src/server/config/clusters";
import { Source } from "src/server/entities/Image";
import { clusterBackendNotSupported } from "src/server/utils/errors";
import { LoginInfo } from "src/server/utils/image";
import { Logger } from "ts-log";

import { ScowdImageDriver } from "./scowdImageDriver";

export interface CreateImageParams {
  source: Source;
  sourcePath: string;
  name: string;
  tag: string;
  loginInfo: LoginInfo;
  harborImageUrl: string;
  imageId: number;
  noCheckPermission?: boolean;
}
export interface copyImageParams {
  // 复制的镜像源ID
  imageId: number;
  sourcePath: string | undefined;
  newName: string;
  newTag: string;
  harborImageUrl: string;
  // 复制后新生成的镜像ID
  newImageId: number;
}
export interface saveImageParams {
  node: string;
  rowContainerId: string;
  localImageUrl: string;
  harborImageUrl: string;
  imageId: number;
}
export interface ImageDriver {
  createImage(params: CreateImageParams): Promise<void>;
  copyImage(params: copyImageParams): Promise<void>;
  saveImage(params: saveImageParams): Promise<void>;
}

interface ImageDriverProvider {
  supports(clusterId: string): boolean;
  create(opts: { clusterId: string; userId: string; logger: Logger }): ImageDriver;
}

const imageDriverProviders: ImageDriverProvider[] = [
  {
    supports: (clusterId) => clusters[clusterId]?.scowd?.enabled === true,
    create: ({ clusterId, userId, logger }) => new ScowdImageDriver(clusterId, userId, logger),
  },
];

function createImageDriver(opts: { clusterId: string; userId: string; logger: Logger }): ImageDriver {
  const { clusterId, userId, logger } = opts;
  const cluster = clusters[clusterId];

  if (!cluster) {
    throw new TRPCError({ code: "NOT_FOUND", message: "cluster is not found" });
  }

  const provider = imageDriverProviders.find((provider) => provider.supports(clusterId));
  if (!provider) {
    throw clusterBackendNotSupported(clusterId);
  }

  return provider.create({ clusterId, userId, logger });
}

export async function withImageDriver<T>(
  params: {
    clusterId: string;
    user: string;
  },
  handler: (driver: ImageDriver) => Promise<T>,
  logger: Logger,
) {
  const driver = createImageDriver({
    clusterId: params.clusterId,
    userId: params.user,
    logger,
  });

  try {
    return await handler(driver);
  } catch (err: any) {
    logger.error(
      `Error in image operation by user ${params.user} in cluster ${params.clusterId}, ` +
        `executing handler, err:${err}`,
    );
    throw err;
  }
}
