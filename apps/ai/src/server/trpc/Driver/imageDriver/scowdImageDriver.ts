import { ScowdClient } from "@scow/lib-scowd/build/client";
import { TRPCError } from "@trpc/server";
import { Source } from "src/server/entities/Image";
import { getScowdClient, wrap } from "src/server/trpc/scowd/scowd";
import { ErrorCode } from "src/server/utils/errorCode";
import { getPermissionsFromMode } from "src/server/utils/getPermissionsFromMode";
import { appendImageCreationOutput, cleanupImageCreationOutput,
  COMMIT_DEFAULT_OUTPUT,
  CreationOperation,
  LOAD_DEFAULT_OUTPUT } from "src/server/utils/imageCreationManager";
import { Logger } from "ts-log";

import { copyImageParams, CreateImageParams, ImageDriver, saveImageParams } from "./imageDriver";
import { pullImageWithResStream, pushImageWithResStream, withAbortHandling } from "./imageStreamProcessor";

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
    imageId,
    noCheckPermission,
  }: CreateImageParams): Promise<void> {

    return withAbortHandling(imageId, async (abortController) => {

      let localImageUrl: string | undefined = undefined;

      try {
        if (source === Source.INTERNAL) {
        // LOAD_IMAGE START
          appendImageCreationOutput(
            imageId, CreationOperation.LOAD_IMAGE, LOAD_DEFAULT_OUTPUT, this.logger);
          // 本地镜像检查源文件拥有者权限
          const sourcePathExists = await wrap(
            this.client.file.exists({
              userId: this.userId,
              path:sourcePath,
              noCheckPermission,
            }),
            this.logger,
          );

          // 判断目标文件夹是否存在
          if (!sourcePathExists.exists) {
            this.logger.error(`
              Image (ID: ${imageId}, Name: ${name}:${tag}) create failed. ${sourcePath} is not found.`);
            cleanupImageCreationOutput(imageId, this.logger);
            throw new TRPCError({
              code: "NOT_FOUND",
              message: `Image (ID: ${imageId}, Name: ${name}:${tag}) create failed. ${sourcePath} is not found.`,
              cause: ErrorCode.FILE_NOT_EXSIT,
            });
          }

          const { permission:toPathPermission } = await wrap(
            this.client.file.getFileMetadata({
              userId: this.userId,
              filePath:sourcePath,
              noCheckPermission,
            }),
            this.logger,
          );

          const { canRead } = getPermissionsFromMode(toPathPermission);
          if (!canRead) {
            this.logger.error(`
              Image (ID: ${imageId}, Name: ${name}:${tag}) create failed. ${sourcePath} is not readable`);
            cleanupImageCreationOutput(imageId, this.logger);
            throw new TRPCError({
              code: "FORBIDDEN",
              message: `Image (ID: ${imageId}, Name: ${name}:${tag}) create failed. ${sourcePath} is not readable`,
              cause: ErrorCode.FILE_NOT_READABLE,
            });
          }
          // 以上是ssh中的checkSharePermission

          // 检查是否为tar文件
          if (!sourcePath.endsWith(".tar")) {
            cleanupImageCreationOutput(imageId, this.logger);
            throw new Error(`Image (ID: ${imageId}, Name: ${name}:${tag}) create failed: image is not a tar file`);
          }

          // 本地镜像时加载镜像
          const loadResponse = await wrap(
            this.client.image.loadImage({
              userId:"root",
              sourcePath,
            }),
            this.logger,
          ).catch((e) => {

            cleanupImageCreationOutput(imageId, this.logger);

            if (abortController.signal.aborted) {
              this.logger.error(
                `Load operation for image (ID: ${imageId}, Name: ${name}:${tag}) was aborted`);
              cleanupImageCreationOutput(imageId, this.logger);
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Load image (ID: ${imageId}, Name: ${name}:${tag}) failed due to abort`,
              });
            }

            this.logger.error(`Load image (ID: ${imageId}, Name: ${name}:${tag}) `
              + `failed while creating the image, ${e.message}`);
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Load image (ID: ${imageId}, Name: ${name}:${tag}) failed `
              + `while creating the image, ${e.message}`,
            });
          });

          // LOAD_IMAGE COMPLETED
          appendImageCreationOutput(
            imageId, CreationOperation.LOAD_IMAGE, LOAD_DEFAULT_OUTPUT, this.logger, true);
          const imageUrl = loadResponse.imageUrl;
          localImageUrl = imageUrl;
        } else {

          const pullResult = await pullImageWithResStream({
            imageId,
            sourcePath,
            loginInfo,
            abortController,
            logger: this.logger,
            customTimeoutClient: this.customTimeoutClient,
            fromCreateOrCopy: "CREATE",
            imageName: name,
            imageTag: tag,
          });

          localImageUrl = pullResult;
        }

        await pushImageWithResStream({
          imageId,
          localImageUrl,
          harborImageUrl,
          abortController,
          logger: this.logger,
          customTimeoutClient: this.customTimeoutClient,
        });
      } catch (err: any) {

        // 检查是否是中断导致的
        if (abortController.signal.aborted) {
          this.logger.error(`Image (ID: ${imageId}, Name: ${name}:${tag}) creation was cancelled by delete image`);
        } else {
          this.logger.error(`Image (ID: ${imageId}, Name: ${name}:${tag}) creation failed: ${err.message}`);
        }
        throw err;

      }
    }, this.logger);
  }

  async copyImage({
    imageId,
    sourcePath,
    newName,
    newTag,
    harborImageUrl,
    newImageId,
  }: copyImageParams): Promise<void> {

    return withAbortHandling(newImageId, async (abortController) => {
      try {
        // 拉取远程镜像
        if (sourcePath === undefined) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Copy Image (ID: ${imageId}, Name: ${newName}:${newTag}) error: shared image do not have path`,
          });
        }

        let localImageUrl: string | undefined = undefined;
        const pullResult = await pullImageWithResStream({
          imageId: newImageId,
          sourcePath,
          abortController,
          logger: this.logger,
          customTimeoutClient: this.customTimeoutClient,
          fromCreateOrCopy: "COPY",
          imageName: newName,
          imageTag: newTag,
        });
        localImageUrl = pullResult;

        await pushImageWithResStream({
          imageId: newImageId,
          localImageUrl,
          harborImageUrl,
          abortController,
          logger: this.logger,
          customTimeoutClient: this.customTimeoutClient,
        });

      } catch (err: any) {

        // 检查是否是中断导致的
        if (abortController.signal.aborted) {
          this.logger.error(
            `Image (ID: ${newImageId}, Name: ${newName}:${newTag}) creation was cancelled by delete image`);
        } else {
          this.logger.error(`Image (ID: ${newImageId}, Name: ${newName}:${newTag}) creation failed: ${err.message}`);
        }
        throw err;

      }
    }, this.logger);
  }

  async saveImage({
    node,
    rowContainerId,
    localImageUrl,
    harborImageUrl,
    imageId,
  }: saveImageParams): Promise<void> {

    return withAbortHandling(imageId, async (abortController) => {
      try {
      // COMMIT_IMAGE START
        appendImageCreationOutput(imageId, CreationOperation.COMMIT_IMAGE, COMMIT_DEFAULT_OUTPUT, this.logger);
        await wrap(
          this.client.image.commitContainerImage({
            userId:"root",
            rowContainerId,
            node,
            imageUrl:localImageUrl,
          }),
          this.logger,
        ).catch((e) => {

          cleanupImageCreationOutput(imageId, this.logger);
          if (abortController.signal.aborted) {
            this.logger.error(
              "Commit image aborted due to abort. "
              + `Image (ID: ${imageId}, from ${localImageUrl} to ${harborImageUrl}).`,
            );
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Commit image aborted due to abort. "
              + `Image (ID: ${imageId}, from ${localImageUrl} to ${harborImageUrl}).`,
            });
          }
          this.logger.error(`Commit container image (ID: ${imageId}, from ${localImageUrl} to ${harborImageUrl}) `
            + `failed while saving the image, ${e.message}`);
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Commit container image (ID: ${imageId}, from ${localImageUrl} to ${harborImageUrl}) `
            + `failed while saving the image, ${e.message}`,
          });
        });

        // COMMIT_IMAGE COMPLETE
        appendImageCreationOutput(imageId, CreationOperation.COMMIT_IMAGE, COMMIT_DEFAULT_OUTPUT, this.logger, true);

        await pushImageWithResStream({
          imageId,
          localImageUrl,
          harborImageUrl,
          abortController,
          logger: this.logger,
          customTimeoutClient: this.customTimeoutClient,
          node,
        });

      } catch (err: any) {

        // 检查是否是中断导致的
        if (abortController.signal.aborted) {
          this.logger.error(`Image (ID: ${imageId}, from ${localImageUrl} to ${harborImageUrl}) `
            + "creation was cancelled by delete image");
        } else {
          this.logger.error(
            `Image (ID: ${imageId}, from ${localImageUrl} to ${harborImageUrl}) creation failed: ${err.message}`);
        }
        throw err;

      }
    }, this.logger);
  }
}

