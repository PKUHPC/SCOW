import { ScowdClient } from "@scow/lib-scowd/build/client";
import { TRPCError } from "@trpc/server";
import { harborPassword, harborUrl, harborUser } from "src/server/utils/harbor";
import { LoginInfo } from "src/server/utils/image";
import {
  removeImageCreationAbortController,
  setImageCreationAbortController,
} from "src/server/utils/imageCreationAbortController";
import {
  appendImageCreationOutput,
  cleanupImageCreationOutput,
  CreationOperation,
  truncateErrorMessage,
} from "src/server/utils/imageCreationManager";
import { Logger } from "ts-log";

export async function withAbortHandling<R>(
  imageId: number,
  fn: (abortController: AbortController) => Promise<R>,
  logger: Logger,
): Promise<R> {
  const abortController = new AbortController();
  setImageCreationAbortController(imageId, abortController);

  try {
    return await fn(abortController);
  } catch (err: any) {
    // 检查是否是中断导致的
    if (abortController.signal.aborted) {
      logger.info(`Image ${imageId} operation was cancelled`);
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Image creation operation failed due to abort. ImageId: ${imageId}`,
      });
    } else {
      logger.error(`Image ${imageId} operation failed: ${err.message}`);
    }
    throw err;
  } finally {
    removeImageCreationAbortController(imageId);
    cleanupImageCreationOutput(imageId, logger);
  }
}

// 定义公共接口
interface PullImageParams {
  imageId: number;
  sourcePath: string;
  loginInfo?: LoginInfo;
  abortController: AbortController;
  logger: Logger;
  customTimeoutClient: ScowdClient;
  fromCreateOrCopy: "CREATE" | "COPY";
  // 打印日志用
  imageName: string;
  imageTag: string;
}

interface PushImageParams {
  imageId: number;
  localImageUrl: string;
  harborImageUrl: string;
  abortController: AbortController;
  logger: Logger;
  customTimeoutClient: ScowdClient;
  node?: string;
}

// Pull 镜像公共函数
export async function pullImageWithResStream({
  imageId,
  sourcePath,
  loginInfo,
  abortController,
  logger,
  customTimeoutClient,
  fromCreateOrCopy,
  imageName,
  imageTag,
}: PullImageParams): Promise<string> {
  let isPullCompleted = false;
  let pullExitCode = 0;
  // 用于返回错误信息后续保存到数据库
  let pullErrBuffer = "";
  let imageUrl: string | undefined = undefined;

  // PULL_IMAGE START
  appendImageCreationOutput(imageId, CreationOperation.PULL_IMAGE, "", logger);

  try {
    const pullResStream = customTimeoutClient.image.pullImage(
      {
        userId: "root",
        sourcePath,
        ...(loginInfo && { loginInfo }),
      },
      { signal: abortController.signal },
    );

    // 处理流式响应
    for await (const response of pullResStream) {
      if (abortController.signal.aborted) {
        logger.trace(`Pull operation for image (ID: ${imageId}, Name: ${imageName}:${imageTag}) was aborted.`);
        cleanupImageCreationOutput(imageId, logger);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Pull image failed due to abort. Image (ID:${imageId}, Name: ${imageName}:${imageTag}).`,
        });
      }

      logger.trace(`Image (ID: ${imageId}, Name: ${imageName}:${imageTag}) pull response: ${JSON.stringify(response)}`);

      if (response.message.case === "output") {
        const stdoutBuffer = response.message.value.stdoutContent ?? "";
        const stderrBuffer = response.message.value.stderrContent ?? "";
        appendImageCreationOutput(imageId, CreationOperation.PULL_IMAGE, stdoutBuffer, logger);
        pullErrBuffer += stderrBuffer;
      } else if (response.message.case === "completed") {
        isPullCompleted = true;
        pullExitCode = response.message.value.exitCode;
        imageUrl = response.message.value.imageUrl;
        logger.info(
          `Pull completed of image (ID:${imageId}, Name: ${imageName}:${imageTag}) with exit code: ${pullExitCode}.`,
        );
        break;
      }
    }

    if (abortController.signal.aborted) {
      logger.trace(`Pull operation for image (ID: ${imageId}, Name: ${imageName}:${imageTag}) was aborted.`);
      cleanupImageCreationOutput(imageId, logger);
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Pull image failed due to abort. Image (ID: ${imageId}, Name: ${imageName}:${imageTag}).`,
      });
    }

    // 检查退出码
    if (!isPullCompleted || pullExitCode !== 0) {
      const truncatedError = truncateErrorMessage(pullErrBuffer);
      logger.error(`Pull image (ID: ${imageId}, Name: ${imageName}:${imageTag}) failed with error: ${truncatedError}.`);
      cleanupImageCreationOutput(imageId, logger);
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          `Pull image (ID: ${imageId}, Name: ${imageName}:${imageTag}) ` +
          `failed while creating the image, ${truncatedError}`,
      });
    }

    // PULL_IMAGE COMPLETED
    appendImageCreationOutput(imageId, CreationOperation.PULL_IMAGE, "", logger, true);

    if (!imageUrl) {
      cleanupImageCreationOutput(imageId, logger);
      logger.error(`Create image (ID: ${imageId}, Name: ${imageName}:${imageTag}) failed: localImage not found.`);
      if (fromCreateOrCopy === "CREATE") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Image (ID: ${imageId}, Name: ${imageName}:${imageTag}) create failed: localImage not found`,
        });
      } else {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "Copy Image Error: " +
            `Image (ID: ${imageId}, Name: ${imageName}:${imageTag}) create failed: localImage not found`,
        });
      }
    }

    return imageUrl;
  } catch (e: any) {
    cleanupImageCreationOutput(imageId, logger);

    // 如果已经是 TRPCError，直接抛出
    if (e instanceof TRPCError) {
      throw e;
    }
    logger.error(`Pull image (ID: ${imageId}, Name: ${imageName}:${imageTag}) failed: ${e.message}.`);
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        `Pull image (ID: ${imageId}, Name: ${imageName}:${imageTag}) ` +
        `failed while creating the image, ${e.message}`,
    });
  }
}

// Push 镜像公共函数
export async function pushImageWithResStream({
  imageId,
  localImageUrl,
  harborImageUrl,
  abortController,
  logger,
  customTimeoutClient,
  // 保存镜像时，推送镜像时指定tag的节点
  node,
}: PushImageParams): Promise<boolean> {
  let isPushCompleted = false;
  let pushExitCode = 0;
  let pushErrBuffer = "";

  // PUSH_IMAGE START
  appendImageCreationOutput(imageId, CreationOperation.PUSH_IMAGE, "", logger);

  try {
    const pushResStream = customTimeoutClient.image.pushImageToHarbor(
      {
        userId: "root",
        localImageUrl,
        harborImageUrl,
        harborInfo: {
          url: harborUrl,
          user: harborUser,
          password: harborPassword,
        },
        node,
      },
      {
        signal: abortController.signal,
      },
    );

    // 处理流式响应
    for await (const response of pushResStream) {
      if (abortController.signal.aborted) {
        logger.trace(`Push operation for image (ID: ${imageId}, ${localImageUrl}) was aborted`);
        cleanupImageCreationOutput(imageId, logger);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Push image failed due to abort. " + `Image: (ID: ${imageId}, Image: ${localImageUrl}).`,
        });
      }

      logger.trace(`Image (ID: ${imageId}, ${localImageUrl}) Push response: ${JSON.stringify(response)}`);

      if (response.message.case === "output") {
        const stdoutBuffer = response.message.value.stdoutContent ?? "";
        const stderrBuffer = response.message.value.stderrContent ?? "";
        appendImageCreationOutput(imageId, CreationOperation.PUSH_IMAGE, stdoutBuffer, logger);
        pushErrBuffer += stderrBuffer;
      } else if (response.message.case === "completed") {
        isPushCompleted = true;
        pushExitCode = response.message.value.exitCode;
        logger.info(`Push completed with exit code: ${pushExitCode}. Image (ID: ${imageId}, Image: ${localImageUrl}).`);
        break;
      }
    }

    if (abortController.signal.aborted) {
      logger.trace(`Push operation for image (ID: ${imageId}, Image: ${localImageUrl}) was aborted.`);
      cleanupImageCreationOutput(imageId, logger);
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Push aborted due to client disconnection. (ID: ${imageId}, Image: ${localImageUrl}).`,
      });
    }

    if (!isPushCompleted || pushExitCode !== 0) {
      const truncatedError = truncateErrorMessage(pushErrBuffer);
      logger.error(
        `Push Image failed  (ImageID: ${imageId}, from ${localImageUrl} to ${harborImageUrl}) ` +
          `with error: ${truncatedError}.`,
      );
      cleanupImageCreationOutput(imageId, logger);
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          `Push image failed (ImageID: ${imageId}, from ${localImageUrl} to ${harborImageUrl}) ` +
          `while creating the image, ${truncatedError}`,
      });
    }

    // PUSH_IMAGE COMPLETED
    appendImageCreationOutput(imageId, CreationOperation.PUSH_IMAGE, "", logger, true, true);
    logger.info(
      "Push image to harbor completed successfully. " +
        `ImageID: ${imageId}, from ${localImageUrl} to ${harborImageUrl}.`,
    );

    return true;
  } catch (e: any) {
    cleanupImageCreationOutput(imageId, logger);

    // 如果已经是 TRPCError，直接抛出
    if (e instanceof TRPCError) {
      throw e;
    }

    logger.error(
      `Push image failed (ImageID: ${imageId}, from ${localImageUrl} to ${harborImageUrl}) ` +
        `while creating the image, ${e.message}`,
    );
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        `Push image failed (ImageID: ${imageId}, from ${localImageUrl} to ${harborImageUrl}) ` +
        `while creating the image, ${e.message}`,
    });
  }
}
