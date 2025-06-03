import { ScowdClient } from "@scow/lib-scowd/build/client";
import { TRPCError } from "@trpc/server";
import { Source } from "src/server/entities/Image";
import { ErrorCode } from "src/server/utils/errorCode";
import { getPermissionsFromMode } from "src/server/utils/getPermissionsFromMode";
import { getK8sRuntime, getRuntimeCommand, harborUrl, harborUser,password } from "src/server/utils/image";
import { Logger } from "ts-log";

import { getScowdClient, wrap } from "../../scowd/scowd";
import { copyImageParams, CreateImageParams, ImageDriver, saveImageParams } from "./imageDriver";

export class ScowdImageDriver implements ImageDriver {

  private client: ScowdClient;
  private customTimeoutClient: ScowdClient;

  constructor(
    private clusterId: string,
    private userId: string,
    private logger: Logger,
  ) {
    this.client = getScowdClient(this.clusterId);

    // pull 和 push 镜像可能会很耗时，手动设置超时时间，先定1h
    this.customTimeoutClient = getScowdClient(this.clusterId,{
      // HTTP/2 连接空闲时长，超过后关闭连接
      idleConnectionTimeoutMs: 1 * 60 * 60 * 1000,
      // 单个请求默认超时时间
      defaultTimeoutMs: 1 * 60 * 60 * 1000,
    });
  }

  async createImage({
    source,
    sourcePath,
    name,
    tag,
    loginInfo,
    harborImageUrl,
  }: CreateImageParams): Promise<void> {
    let localImageUrl: string | undefined = undefined;
    const runtime = getK8sRuntime(this.clusterId);
    const command = getRuntimeCommand(runtime);

    if (source === Source.INTERNAL) {
      // 本地镜像检查源文件拥有者权限
      const sourcePathExists = await wrap(
        this.client.file.exists({
          userId: this.userId,
          path:sourcePath,
        }),
        this.logger,
      );

      // 判断目标文件夹是否存在
      if (!sourcePathExists.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `${sourcePath} is not found`,
          cause: ErrorCode.FILE_NOT_EXSIT,
        });
      }

      const { permission:toPathPermission } = await wrap(
        this.client.file.getFileMetadata({
          userId: this.userId,
          filePath:sourcePath,
        }),
        this.logger,
      );

      const { canRead } = getPermissionsFromMode(toPathPermission);
      if (!canRead) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `${sourcePath} is not readable`,
          cause: ErrorCode.FILE_NOT_READABLE,
        });
      }
      // 以上是ssh中的checkSharePermission

      // 检查是否为tar文件
      if (!sourcePath.endsWith(".tar")) {
        throw new Error(`Image ${name}:${tag} create failed: image is not a tar file`);
      }

      // 本地镜像时加载镜像
      const { imageUrl } = await wrap(
        this.client.image.loadedImage({
          userId:"root",
          command,
          sourcePath,
        }),
        this.logger,
      ).catch((e) => {
        this.logger.error(`getLoadedImage failed while creating the image, ${e.message}`);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `getLoadedImage failed while creating the image, ${e.message}`,
        });
      });

      localImageUrl = imageUrl;
    } else {
      const { imageUrl } = await wrap(
        this.customTimeoutClient.image.pulledImage({
          userId:"root",
          command,
          sourcePath,
          loginInfo,
        }),
        this.logger,
      ).catch((e) => {
        this.logger.error(`getPulledImage failed while creating the image, ${e.message}`);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `getPulledImage failed while creating the image, ${e.message}`,
        });
      });

      localImageUrl = imageUrl;
    }

    if (localImageUrl === undefined) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Image ${name}:${tag} create failed: localImage not found`,
      });
    }

    await wrap(
      this.customTimeoutClient.image.pushImageToHarbor({
        userId:"root",
        command,
        localImageUrl,
        harborImageUrl,
        harborInfo:{
          url:harborUrl,
          user:harborUser,
          password:password,
        },
      }),
      this.logger,
    )
      .catch((e) => {
        this.logger.error(`pushImageToHarbor failed while creating the image, ${e.message}`);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `pushImageToHarbor failed while creating the image, ${e.message}`,
        });
      });
  }

  async copyImage({
    imageId,
    sourcePath,
    newName,
    newTag,
    harborImageUrl,
  }: copyImageParams): Promise<void> {
    const runtime = getK8sRuntime(this.clusterId);
    const command = getRuntimeCommand(runtime);
    // 拉取远程镜像
    if (sourcePath === undefined) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `copyImage error: shared image ${imageId} do not have path`,
      });
    }

    const { imageUrl:localImageUrl } = await wrap(
      this.customTimeoutClient.image.pulledImage({
        userId:"root",
        command,
        sourcePath,
      }),
      this.logger,
    ).catch((e) => {
      this.logger.error(`getPulledImage failed while copying the image, ${e.message}`);
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `getPulledImage failed while copying the image, ${e.message}`,
      });
    });

    if (!localImageUrl) {
      throw new Error(`copyImage Error: Image ${newName}:${newTag} create failed: localImage not found`);
    }

    await wrap(
      this.customTimeoutClient.image.pushImageToHarbor({
        userId:"root",
        command,
        localImageUrl,
        harborImageUrl,
        harborInfo:{
          url:harborUrl,
          user:harborUser,
          password:password,
        },
      }),
      this.logger,
    ).catch((e) => {
      this.logger.error(`pushImageToHarbor failed while copying the image, ${e.message}`);
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `pushImageToHarbor failed while copying the image, ${e.message}`,
      });
    });
  }

  async saveImage({
    node,
    formattedContainerId,
    localImageUrl,
    harborImageUrl,
  }: saveImageParams): Promise<void> {
    const runtime = getK8sRuntime(this.clusterId);
    const command = getRuntimeCommand(runtime);
    await wrap(
      this.client.image.commitContainerImage({
        userId:"root",
        command,
        formattedContainerId,
        node,
        imageUrl:localImageUrl,
      }),
      this.logger,
    ).catch((e) => {
      this.logger.error(`commitContainerImage failed while saving the image, ${e.message}`);
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `commitContainerImage failed while saving the image, ${e.message}`,
      });
    });

    await wrap(
      this.customTimeoutClient.image.pushImageToHarbor({
        userId:"root",
        command,
        localImageUrl,
        harborImageUrl,
        harborInfo:{
          url:harborUrl,
          user:harborUser,
          password:password,
        },
        node,
      }),
      this.logger,
    ).catch((e) => {
      this.logger.error(`pushImageToHarbor failed while saving the image, ${e.message}`);
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `pushImageToHarbor failed while saving the image, ${e.message}`,
      });
    });
  }
}
