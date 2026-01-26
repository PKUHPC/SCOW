import { TRPCError } from "@trpc/server";
import { Source } from "src/server/entities/Image";
import { commitContainerImage, formatContainerId, getLoadedImage, getPulledImage,
  pushImageToHarbor } from "src/server/utils/image";
import { checkSharePermission } from "src/server/utils/share";
import { sshConnect } from "src/server/utils/ssh";
import { Logger } from "ts-log";

import { copyImageParams, CreateImageParams, ImageDriver, saveImageParams } from "./imageDriver";

export class SshImageDriver implements ImageDriver {
  constructor(
    private clusterId: string,
    private host: string,
    private userId: string,
    private logger: Logger,
  ) {}

  async createImage({
    source,
    sourcePath,
    name,
    tag,
    loginInfo:{ userName,password },
    harborImageUrl,
  }: CreateImageParams): Promise<void> {
    await sshConnect(this.host, "root", this.logger, async (ssh) => {
      let localImageUrl: string | undefined = undefined;
      if (source === Source.INTERNAL) {
        // 本地镜像检查源文件拥有者权限
        await checkSharePermission({ ssh, logger:this.logger, sourcePath: sourcePath, userId: this.userId });
        // 检查是否为tar文件
        if (!sourcePath.endsWith(".tar")) {
          throw new Error(`Image ${name}:${tag} create failed: image is not a tar file`);
        }

        // 本地镜像时加载镜像
        localImageUrl = await getLoadedImage({
          ssh,
          logger:this.logger,
          sourcePath,
        }).catch((e) => {
          this.logger.error(`getLoadedImage failed while creating the image, ${e.message}`);
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `getLoadedImage failed while creating the image, ${e.message}`,
          });
        });
      } else {
        // 远程镜像需先拉取到本地
        localImageUrl = await getPulledImage({
          ssh,
          logger:this.logger,
          sourcePath,
          loginInfo:{ userName,password },
        }).catch((e) => {
          this.logger.error(`getPulledImage failed while creating the image, ${e.message}`);
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `getPulledImage failed while creating the image, ${e.message}`,
          });
        });
      }

      if (localImageUrl === undefined) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Image ${name}:${tag} create failed: localImage not found`,
        });
      }

      // 制作镜像，上传至harbor
      await pushImageToHarbor({
        ssh,
        logger:this.logger,
        localImageUrl,
        harborImageUrl,
      }).catch((e) => {
        this.logger.error(`pushImageToHarbor failed while creating the image, ${e.message}`);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `pushImageToHarbor failed while creating the image, ${e.message}`,
        });
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
    await sshConnect(this.host, "root", this.logger, async (ssh) => {
      // 拉取远程镜像
      if (sourcePath === undefined) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `copyImage error: shared image ${imageId} do not have path`,
        });
      }

      const localImageUrl = await getPulledImage({
        ssh,
        logger:this.logger,
        sourcePath,
      })
        .catch((e) => {
          this.logger.error(`getPulledImage failed while copying the image, ${e.message}`);
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `getPulledImage failed while copying the image, ${e.message}`,
          });
        });
      if (!localImageUrl) {
        throw new Error(`copyImage Error: Image ${newName}:${newTag} create failed: localImage not found`);
      }

      // 制作镜像上传
      await pushImageToHarbor({
        ssh,
        logger:this.logger,
        localImageUrl,
        harborImageUrl,
      }).catch((e) => {
        this.logger.error(`pushImageToHarbor failed while copying the image, ${e.message}`);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `pushImageToHarbor failed while copying the image, ${e.message}`,
        });
      });
    });
  }

  async saveImage({
    node,
    rowContainerId,
    localImageUrl,
    harborImageUrl,
  }: saveImageParams): Promise<void> {
    await sshConnect(node, "root", this.logger, async (ssh) => {
      // commit镜像
      await commitContainerImage({
        node,
        ssh,
        logger:this.logger,
        formattedContainerId:formatContainerId(rowContainerId),
        localImageUrl,
      }).catch((e) => {
        this.logger.error(`commitContainerImage failed while saving the image, ${e.message}`);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `commitContainerImage failed while saving the image, ${e.message}`,
        });
      });

      // 保存镜像至harbor
      await pushImageToHarbor({
        ssh,
        logger:this.logger,
        localImageUrl,
        harborImageUrl,
      }).catch((e) => {
        this.logger.error(`pushImageToHarbor failed while saving the image, ${e.message}`);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `pushImageToHarbor failed while saving the image, ${e.message}`,
        });
      });
    });
  }
}
