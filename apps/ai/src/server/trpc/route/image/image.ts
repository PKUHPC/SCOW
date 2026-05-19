import { getSortedClusterIds } from "@scow/config/build/cluster";
import { OperationResult, OperationType } from "@scow/lib-operation-log";
import { libGetUsersByIds } from "@scow/lib-server";
import { TRPCError } from "@trpc/server";
import dayjs from "dayjs";
import { ImageType } from "src/models/Image";
import { commonConfig } from "src/server/config/common";
import { config } from "src/server/config/env";
import { Image, Source, Status } from "src/server/entities/Image";
import { callLog } from "src/server/setup/operationLog";
import { procedure } from "src/server/trpc/procedure/base";
import { PlatformRole } from "src/server/trpc/route/auth";
import { ensureAiUserShareEnabled } from "src/server/utils/assetShare";
import { checkClusterAvailable, shouldPathsSkipPermissionCheck } from "src/server/utils/clusters";
import { forkEntityManager } from "src/server/utils/getOrm";
import { getHarborConfig, HarborClient } from "src/server/utils/harbor";
import { bytesToGB, createHarborImageUrl, getUserHarborProjectName, isValidImageAddress } from "src/server/utils/image";
import { imageCreationAbortOperation } from "src/server/utils/imageCreationAbortController";
import { CreationOperation, getCurrentImageCreationLog } from "src/server/utils/imageCreationManager";
import { logger } from "src/server/utils/logger";
import { paginationProps } from "src/server/utils/orm";
import { paginationSchema } from "src/server/utils/pagination";
import { parseIp } from "src/utils/parse";
import { z } from "zod";

import { getCurrentClusters } from "../../../utils/clusters";
import { driver } from "../../Driver";
import { clusters } from "../config";
import { booleanQueryParam, clusterExist } from "../utils";

class NoClusterError extends TRPCError {
  constructor(name: string, tag: string) {
    super({
      code: "NOT_FOUND",
      message: `Image ${name}:${tag} create failed: there is no available cluster`,
    });
  }
}

export const ImageListSchema = z.object({
  id: z.number(),
  name: z.string(),
  owner: z.string().optional(),
  ownerId: z.string().optional(),
  ownerName: z.string().optional(),
  source: z.enum(Source),
  tag: z.string(),
  description: z.string().optional(),
  path: z.string().optional(),
  sourcePath: z.string().optional(),
  status: z.enum(Status),
  isShared: z.boolean(),
  clusterId: z.string().optional(),
  createTime: z.string().optional(),
  updateTime: z.string().optional(),
  types: z.array(z.enum([ImageType.APP, ImageType.TRAIN, ImageType.INFER, ImageType.DEV_HOST])),
  inferServicePort: z.string().optional(),
  startCommand: z.string().optional(),
  failedReason: z.string().optional(),
  isPlatformOwned: z.boolean(),
});

export const list = procedure
  .meta({
    openapi: {
      method: "GET",
      path: "/images",
      tags: ["image"],
      summary: "Read all images",
    },
  })
  .input(
    z.object({
      ...paginationSchema.shape,
      nameOrTagOrDesc: z.string().optional(),
      isPublic: booleanQueryParam().optional(),
      clusterId: z.string().optional(),
      withExternal: booleanQueryParam().optional(),
      // GET请求不能传array类型
      types: z.string().optional().default(""),
      isPlatformOwned: z.boolean().optional(), // 是否为平台管理员公共数据资产
    }),
  )
  .output(z.object({ items: z.array(ImageListSchema), count: z.number() }))
  .query(async ({ input, ctx: { user } }) => {
    const {
      clusterId,
      isPublic,
      nameOrTagOrDesc,
      withExternal,
      types: rawTypes,
      isPlatformOwned,
      pageSize,
      page,
    } = input;

    // 如果查询某一个集群
    if (clusterId) {
      // 再次检查当前查询集群是否为在线可用集群
      const currentClusterIds = await getCurrentClusters(user.identityId);
      checkClusterAvailable(currentClusterIds, clusterId);
    }

    const types = rawTypes
      ? rawTypes.split(",").filter((t): t is ImageType => Object.values(ImageType).includes(t as ImageType))
      : [];

    const em = await forkEntityManager();

    // 构建查询条件
    let isPublicQuery: any;

    if (isPlatformOwned) {
      // isPlatformOwned 为 true 时，公共数据资产只包含平台拥有的
      isPublicQuery = { isPlatformOwned: true };
    } else if (isPublic) {
      isPublicQuery = {
        isShared: true,
        owner: { $ne: null },
      };
    } else {
      isPublicQuery = {
        owner: user.identityId,
        isPlatformOwned: false,
      };
    }

    const nameOrTagOrDescQuery = nameOrTagOrDesc
      ? {
          $or: [
            { name: { $like: `%${nameOrTagOrDesc}%` } },
            { tag: { $like: `%${nameOrTagOrDesc}%` } },
            { description: { $like: `%${nameOrTagOrDesc}%` } },
          ],
        }
      : {};

    const typesQuery =
      types.length > 0
        ? {
            $or: types.map((type) => ({
              types: { $like: `%${type}%` },
            })),
          }
        : {};

    const [items, count] = await em.findAndCount(
      Image,
      {
        $and: [
          nameOrTagOrDescQuery,
          isPublicQuery,
          typesQuery,
          input.clusterId
            ? withExternal
              ? { $or: [{ clusterId }, { clusterId: { $eq: null } }] }
              : { clusterId }
            : {},
        ],
      },
      {
        ...paginationProps(page, pageSize),
        orderBy: isPublic ? { name: "asc" } : { createTime: "desc" },
      },
    );

    const ownerIds = Array.from(new Set(items.map((item) => item.owner).filter((owner): owner is string => !!owner)));

    let ownerNameMap: Record<string, string> = {};

    if (ownerIds.length > 0 && config.MIS_DEPLOYED && config.MIS_SERVER_URL && commonConfig.scowApi?.auth?.token) {
      try {
        const usersResponse = await libGetUsersByIds(
          ownerIds,
          config.MIS_SERVER_URL,
          commonConfig.scowApi?.auth?.token,
        );
        ownerNameMap = Object.fromEntries((usersResponse.users ?? []).map((user) => [user.userId, user.userName]));
      } catch (error) {
        logger.error(
          {
            err: error,
            ownerIds,
          },
          "Failed to load owner names for owner ids",
        );
      }
    }

    return {
      items: items.map((x) => {
        return {
          ...x,
          owner: x.owner ?? "",
          ownerId: x.owner ?? undefined,
          ownerName: x.owner ? ownerNameMap[x.owner] : undefined,
          isShared: Boolean(x.isShared),
          createTime: x.createTime ? x.createTime.toISOString() : undefined,
          updateTime: x.updateTime ? x.updateTime.toISOString() : undefined,
          types: x.types ?? [],
          inferServicePort: x.inferServicePort,
          startCommand: x.startCommand,
          failedReason: x.failedReason,
          isPlatformOwned: x.isPlatformOwned,
        };
      }),
      count,
    };
  });

export const getImageById = procedure
  .meta({
    openapi: {
      method: "GET",
      path: "/image",
      tags: ["image"],
      summary: "Get image by id",
    },
  })
  .input(
    z.object({
      imageId: z.number(),
    }),
  )
  .output(
    z.object({
      types: z.array(z.enum([ImageType.APP, ImageType.TRAIN, ImageType.INFER, ImageType.DEV_HOST])),
      inferServicePort: z.string().optional(),
      startCommand: z.string().optional(),
    }),
  )
  .query(async ({ input: { imageId } }) => {
    const em = await forkEntityManager();

    const image = await em.findOne(Image, {
      id: imageId,
    });

    if (!image) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Image ${imageId} not found`,
      });
    }

    return {
      types: image.types ?? [],
      inferServicePort: image.inferServicePort,
      startCommand: image.startCommand,
    };
  });

export const createImage = procedure
  .meta({
    openapi: {
      method: "POST",
      path: "/images",
      tags: ["image"],
      summary: "Create a new image",
    },
  })
  .input(
    z.object({
      name: z.string(),
      tag: z.string(),
      description: z.string().optional(),
      source: z.enum([Source.INTERNAL, Source.EXTERNAL]),
      sourcePath: z.string(),
      clusterId: z.string(),
      userName: z.string().optional(),
      password: z.string().optional(),
      types: z.array(z.enum([ImageType.APP, ImageType.TRAIN, ImageType.INFER, ImageType.DEV_HOST])),
      inferServicePort: z.string().optional(),
      startCommand: z.string().optional(),
      isPlatformOwned: z.boolean().optional(),
    }),
  )
  .output(z.number())
  .mutation(async ({ input, ctx: { user, req } }) => {
    const currentClusterIds = await getCurrentClusters(user.identityId);
    if (input.clusterId && !clusterExist(input.clusterId, currentClusterIds)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Cluster id ${input.clusterId} does not exist.`,
      });
    }
    const em = await forkEntityManager();
    const { name, tag, source, sourcePath, userName, password, isPlatformOwned = false } = input;

    if (source === Source.EXTERNAL && !isValidImageAddress(sourcePath)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `SourcePath ${sourcePath} is not valid.`,
      });
    }

    // tag的唯一标识符
    const tagPostfix = dayjs().unix().toString();

    const imageNameTagExist = await em.findOne(
      Image,
      isPlatformOwned
        ? { name, tag, isPlatformOwned: true }
        : { name, tag, owner: user.identityId, isPlatformOwned: false },
    );

    if (imageNameTagExist) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `Image's name ${name} with tag ${tag} already exist`,
      });
    }

    if (isPlatformOwned) {
      const isPlatformAdmin = user.platformRoles?.includes(PlatformRole.PLATFORM_ADMIN);
      if (!isPlatformAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only platform admin can create platform owned image",
        });
      }
    }

    // 如果是公共数据资产且为本地上传路径
    if (isPlatformOwned && source === Source.INTERNAL) {
      const noCheckPermission = shouldPathsSkipPermissionCheck(input.clusterId, [sourcePath], true);
      if (!noCheckPermission) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `${sourcePath} is outside the required PublicPath boundary`,
        });
      }
    }

    // 获取加载镜像的集群节点
    const processClusterId = input.clusterId;

    if (!processClusterId) {
      throw new NoClusterError(name, tag);
    }
    checkClusterAvailable(currentClusterIds, processClusterId);

    const harborImageUrl = await createHarborImageUrl(name, tag + tagPostfix, user.identityId, logger, isPlatformOwned);

    // 创建一个状态为 creating 的数据
    const image = new Image({
      ...input,
      path: harborImageUrl,
      status: Status.CREATING,
      owner: user.identityId,
      tagPostfix,
      isPlatformOwned,
    });
    await em.persistAndFlush([image]);

    const createProcess = async () => {
      const em = await forkEntityManager();
      const image = await em.findOne(Image, { name, tag, owner: user.identityId, isPlatformOwned });

      if (!image) {
        throw new Error(`Image creation error: image ${name}:${tag} not found`);
      }

      const logInfo = {
        operatorUserId: user.identityId,
        operatorIp: parseIp(req) ?? "",
        operationTypeName: OperationType.createImage,
      };

      try {
        await driver.withImageDriver(
          {
            clusterId: processClusterId,
            user: user.identityId,
          },
          async (imageDriver) => {
            await imageDriver.createImage({
              source,
              sourcePath,
              name,
              tag,
              loginInfo: { userName, password },
              harborImageUrl,
              imageId: image.id,
              noCheckPermission: isPlatformOwned,
            });
          },
          logger,
        );

        // 更新数据库
        image.status = Status.CREATED;
        await em.persistAndFlush(image);

        await callLog(
          {
            ...logInfo,
            operationTypePayload: {
              clusterId: input.clusterId,
              tag,
              imageId: image.id,
              imageName: name,
            },
          },
          OperationResult.SUCCESS,
        );

        return;
      } catch (err: any) {
        image.failedReason = err.message;
        image.status = Status.FAILURE;
        await em.persistAndFlush(image);

        await callLog(
          {
            ...logInfo,
            operationTypePayload: {
              clusterId: input.clusterId,
              tag,
              imageName: name,
            },
          },
          OperationResult.FAIL,
        );
        throw err;
      }
    };

    createProcess();
    return image.id;
  });

export const updateImage = procedure
  .meta({
    openapi: {
      method: "PUT",
      path: "/images/{id}",
      tags: ["image"],
      summary: "update a image",
    },
  })
  .input(
    z.object({
      id: z.number(),
      description: z.string().optional(),
      types: z.array(z.enum([ImageType.APP, ImageType.TRAIN, ImageType.INFER, ImageType.DEV_HOST])),
      inferServicePort: z.string().optional(),
      startCommand: z.string().optional(),
      isPlatformOwned: z.boolean().optional(),
    }),
  )
  .output(z.number())
  .use(async ({ input: { id }, ctx, next }) => {
    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.updateImage,
    };

    const em = await forkEntityManager();

    const image = await em.findOne(Image, { id: id });
    if (!image) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Image ${id} not found`,
      });
    }

    const res = await next({ ctx });

    if (res.ok) {
      await callLog(
        {
          ...logInfo,
          operationTypePayload: {
            imageId: id,
            clusterId: image.clusterId ?? "",
            imageName: image.name,
            tag: image.tag,
          },
        },
        OperationResult.SUCCESS,
      );
    }

    if (!res.ok) {
      await callLog(
        {
          ...logInfo,
          operationTypePayload: {
            imageId: id,
            clusterId: image.clusterId ?? "",
            imageName: image.name,
            tag: image.tag,
          },
        },
        OperationResult.FAIL,
      );
    }

    return res;
  })
  .mutation(
    async ({
      input: { id, description, types, inferServicePort, startCommand, isPlatformOwned = false },
      ctx: { user },
    }) => {
      const em = await forkEntityManager();

      const image = await em.findOne(Image, { id: id });
      if (!image) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Image ${id} not found`,
        });
      }

      if (isPlatformOwned) {
        const isPlatformAdmin = user.platformRoles?.includes(PlatformRole.PLATFORM_ADMIN);
        if (!isPlatformAdmin) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only platform admin can update platform owned image",
          });
        }
      }

      if (!isPlatformOwned && image.owner !== user.identityId) {
        const detailMessage = `Image id:${id} is not owned by current user. currentUserId:${user.identityId}`;
        logger.error(detailMessage);
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Operation failed: The image asset does not belong to the current user.",
        });
      }

      image.description = description;
      image.types = types;
      image.inferServicePort = inferServicePort;
      image.startCommand = startCommand;

      await em.flush();
      return image.id;
    },
  );

export const deleteImage = procedure
  .meta({
    openapi: {
      method: "DELETE",
      path: "/images/{id}",
      tags: ["image"],
      summary: "delete a image",
    },
  })
  .input(
    z.object({
      id: z.number(),
      force: booleanQueryParam().optional(),
      isPlatformOwned: z.boolean().optional(),
    }),
  )
  .output(z.void())
  .use(async ({ input: { id }, ctx, next }) => {
    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.deleteImage,
    };

    const em = await forkEntityManager();

    const image = await em.findOne(Image, { id: id });
    if (!image) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Image ${id} not found`,
      });
    }

    const res = await next({ ctx });

    if (res.ok) {
      await callLog(
        {
          ...logInfo,
          operationTypePayload: {
            imageId: id,
            clusterId: image.clusterId ?? "",
            imageName: image.name,
            tag: image.tag,
          },
        },
        OperationResult.SUCCESS,
      );
    }

    if (!res.ok) {
      await callLog(
        {
          ...logInfo,
          operationTypePayload: {
            imageId: id,
            clusterId: image.clusterId ?? "",
            imageName: image.name,
            tag: image.tag,
          },
        },
        OperationResult.FAIL,
      );
    }

    return res;
  })
  .mutation(async ({ input, ctx: { user } }) => {
    const em = await forkEntityManager();
    const image = await em.findOne(Image, { id: input.id });
    const { isPlatformOwned } = input;

    if (!image) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Image ${input.id} not found`,
      });
    }

    // 不允许强制删除时报错
    if (!input.force && image.status === Status.CREATING) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Image ${image.name}:${image.tag} is still being creating.`,
      });
    }

    if (isPlatformOwned) {
      const isPlatformAdmin = user.platformRoles?.includes(PlatformRole.PLATFORM_ADMIN);
      if (!isPlatformAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only platform admin can delete platform owned image",
        });
      }
    }

    if (!isPlatformOwned && image.owner !== user.identityId) {
      const detailMessage = `Image id:${input.id} is not owned by current user. currentUserId:${user.identityId}`;
      logger.error(detailMessage);
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Operation failed: The image asset does not belong to the current user.",
      });
    }

    let creationAbort = false;
    // 允许强制删除时打断创建过程
    if (input.force && image.status === Status.CREATING) {
      creationAbort = imageCreationAbortOperation(image.id);
      if (creationAbort) {
        logger.info(`Successfully aborted image creation for image ${input.id}`);
        // 等待中断生效
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    const harborConfig = getHarborConfig();
    const harbor = new HarborClient(harborConfig);
    // 获取harbor中的reference以删除镜像
    const getReferenceRes = await harbor.getReference({
      userId: user.identityId,
      imageName: image.name,
      isPlatformOwned,
    });

    if (!getReferenceRes.ok) {
      const errorText = await getReferenceRes.text(); // 首先获取文本形式的响应体

      // 没有返回值且镜像本身状态就是 failure 的，不需要去 harbor 删除了
      if (errorText === "" && image.status === Status.FAILURE) {
        logger.error(`Maybe image(${input.id}) ${image.name}:${image.tag} not exist on harbor`);
        await em.removeAndFlush(image);
        return;
      }
      try {
        const errorBody = JSON.parse(errorText); // 尝试解析为 JSON
        const errorMessage = errorBody.errors.map((i: { message?: string }) => i.message).join();
        logger.error("Failed to get image reference: %s", errorMessage);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get image reference: " + errorMessage,
        });
      } catch (e) {
        // 如果解析失败，记录原始响应文本
        logger.error("Failed to parse JSON from error response: %s", errorText);
        throw e; // 重新抛出异常或处理错误
      }
    }

    const referenceRes = await getReferenceRes.json();

    let reference = "";
    let targetArtifactTagCount = 0;

    const allTagsCount = referenceRes.reduce(
      (sum: number, item: { tags?: { name: string }[] }) => sum + (item.tags?.length ?? 0),
      0,
    );
    // 判断是否是唯一的标签，如果是需要删除上级的特定Artifact
    let needDeleteRepository: boolean = false;

    for (const item of referenceRes) {
      if (
        item.tags?.length > 0 &&
        item.tags.find((i: { name: string }) => i.name === image.tag + (image.tagPostfix ?? ""))
      ) {
        reference = item.digest;
        targetArtifactTagCount = item.tags?.length ?? 0;
        needDeleteRepository = allTagsCount === 1;
        break;
      }
    }

    if (!reference) {
      // Harbor API 请求接收到正常返回值，但是在Harbor中没有找到对应镜像，则直接删除本地数据库镜像信息
      logger.error(`Maybe image(${input.id}) ${image.name}:${image.tag} not exist on harbor`);
      await em.removeAndFlush(image);
      return;
    }

    // 如果上面的tag是最相同imageName下相同镜像的最后一个标签，则删除整个Repository
    if (needDeleteRepository) {
      const deleteRepository = await harbor.deleteRepository({
        userId: user.identityId,
        imageName: image.name,
        isPlatformOwned,
      });

      // harbor 删除出错，但状态本身就是失败时无需操作
      if (!deleteRepository.ok) {
        const errorBody = await deleteRepository.json();
        // 来自harbor的错误信息
        const errorMessage = errorBody.errors.map((i: { message?: string }) => i.message).join();
        logger.error("Failed to delete image repository url %s", deleteRepository);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete image repository: " + errorMessage,
        });
      }

      // 如果上面的tag不是相同imageName下相同镜像的最后一个标签，则只删除该标签
    } else {
      const deleteRes = await harbor.deleteTag({
        userId: user.identityId,
        imageName: image.name,
        reference,
        imageTag: image.tag,
        imageTagPostfix: image.tagPostfix ?? "",
        isPlatformOwned,
      });

      // harbor 删除出错，但状态本身就是失败时无需操作
      if (!deleteRes.ok) {
        const errorBody = await deleteRes.json();
        // 来自harbor的错误信息
        const errorMessage = errorBody.errors.map((i: { message?: string }) => i.message).join();
        logger.error("Failed to delete image tag");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete image tag: " + errorMessage,
        });
      }

      // 删除 tag 后如果该 artifact 不再被其它 tag 引用，则删除 artifact
      if (targetArtifactTagCount <= 1) {
        const deleteArtifactRes = await harbor.deleteArtifact({
          userId: user.identityId,
          imageName: image.name,
          reference,
        });

        if (!deleteArtifactRes.ok) {
          const errorBody = await deleteArtifactRes.json();
          const errorMessage = errorBody.errors.map((i: { message?: string }) => i.message).join();
          logger.error("Failed to delete image artifact: " + errorMessage);
        }
      }
    }

    await em.removeAndFlush(image);
    return;
  });

export const shareOrUnshareImage = procedure
  .meta({
    openapi: {
      method: "PUT",
      path: "/images/{id}/share",
      tags: ["image"],
      summary: "share a image",
    },
  })
  .input(z.object({ id: z.number(), share: z.boolean(), isPlatformOwned: z.boolean().optional() }))
  .output(z.void())
  .use(async ({ input: { id, share }, ctx, next }) => {
    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.shareImage,
    };

    const em = await forkEntityManager();

    const image = await em.findOne(Image, { id: id });
    if (!image) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Image ${id} not found`,
      });
    }

    const res = await next({ ctx });

    if (share && res.ok) {
      await callLog(
        {
          ...logInfo,
          operationTypePayload: {
            imageId: id,
            clusterId: image.clusterId ?? "",
            imageName: image.name,
            tag: image.tag,
          },
        },
        OperationResult.SUCCESS,
      );
    }

    if (share && !res.ok) {
      await callLog(
        {
          ...logInfo,
          operationTypePayload: {
            imageId: id,
            clusterId: image.clusterId ?? "",
            imageName: image.name,
            tag: image.tag,
          },
        },
        OperationResult.FAIL,
      );
    }

    return res;
  })
  .mutation(async ({ input, ctx: { user } }) => {
    const em = await forkEntityManager();
    const { id, share, isPlatformOwned } = input;
    ensureAiUserShareEnabled(isPlatformOwned);
    const image = await em.findOne(Image, { id });

    if (!image) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Image ${id} not found`,
      });
    }

    if (image.status === Status.CREATING) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Image ${id} is still being creating.`,
      });
    }

    if (isPlatformOwned) {
      const isPlatformAdmin = user.platformRoles?.includes(PlatformRole.PLATFORM_ADMIN);
      if (!isPlatformAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only platform admin can share platform owned image",
        });
      }
    }

    if (!isPlatformOwned && image.owner !== user.identityId) {
      const detailMessage = `Image id:${id} is not owned by current user. currentUserId:${user.identityId}`;
      logger.error(detailMessage);
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Operation failed: The image asset does not belong to the current user.",
      });
    }

    image.isShared = share;

    await em.persistAndFlush(image);
    return;
  });

export const copyImage = procedure
  .meta({
    openapi: {
      method: "POST",
      path: "/images/{id}/copy",
      tags: ["image"],
      summary: "copy a image",
    },
  })
  .input(
    z.object({
      id: z.number(),
      newName: z.string(),
      newTag: z.string(),
      clusterId: z.optional(z.string()),
      newTypes: z.array(z.enum([ImageType.APP, ImageType.TRAIN, ImageType.INFER, ImageType.DEV_HOST])),
      newInferServicePort: z.string().optional(),
      newStartCommand: z.string().optional(),
      newDescription: z.string().optional(),
    }),
  )
  .output(z.number())
  .use(async ({ input: { id, newTag, newName, clusterId }, ctx, next }) => {
    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.copyImage,
    };

    const em = await forkEntityManager();

    const image = await em.findOne(Image, { id: id });
    if (!image) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Image ${id} not found`,
      });
    }

    const res = await next({ ctx });

    if (res.ok) {
      await callLog(
        {
          ...logInfo,
          operationTypePayload: {
            sourceImageId: id,
            targetImageId: res.data as number,
            targetImageTag: newTag,
            targetImageName: newName,
            clusterId: clusterId ?? "",
            sourceImageName: image.name,
            sourceImageTag: image.tag,
          },
        },
        OperationResult.SUCCESS,
      );
    }

    if (!res.ok) {
      await callLog(
        {
          ...logInfo,
          operationTypePayload: {
            sourceImageId: id,
            targetImageTag: newTag,
            targetImageName: newName,
            clusterId: clusterId ?? "",
            sourceImageName: image.name,
            sourceImageTag: image.tag,
          },
        },
        OperationResult.FAIL,
      );
    }

    return res;
  })
  .mutation(async ({ input, ctx: { user } }) => {
    const em = await forkEntityManager();

    const { id, newName, newTag, clusterId, newTypes, newInferServicePort, newStartCommand, newDescription } = input;

    // tag的唯一标识符
    const tagPostfix = dayjs().unix().toString();

    const sharedImage = await em.findOne(Image, { id, isShared: true, status: Status.CREATED });

    if (!sharedImage) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Shared Image ${id} not found`,
      });
    }

    if (!sharedImage.path || !sharedImage.sourcePath) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Shared Image ${id} do not have path or sourcePath`,
      });
    }

    const imageNameTagsExist = await em.findOne(Image, {
      name: newName,
      tag: newTag,
      owner: user.identityId,
      isPlatformOwned: false,
    });
    if (imageNameTagsExist) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `Image's name ${newName} with tag ${newTag} already exist`,
      });
    }

    // 数据库创建一条状态为创建中的数据
    const image = new Image({
      name: newName,
      tag: newTag,
      tagPostfix,
      owner: user.identityId,
      source: Source.EXTERNAL,
      sourcePath: sharedImage.path,
      status: Status.CREATING,
      description: newDescription,
      clusterId,
      types: newTypes,
      inferServicePort: newInferServicePort,
      startCommand: newStartCommand,
    });
    await em.persistAndFlush(image);

    // 使用原来镜像的集群，防止集群架构不同
    const processClusterId = clusterId ?? getSortedClusterIds(clusters)[0];

    if (!processClusterId) {
      throw new NoClusterError(newName, newTag);
    }

    const currentClusterIds = await getCurrentClusters(user.identityId);
    checkClusterAvailable(currentClusterIds, processClusterId);

    const copyProcess = async () => {
      const em = await forkEntityManager();
      const image = await em.findOne(Image, { name: newName, tag: newTag, owner: user.identityId });

      if (!image) {
        throw new Error(`copyImage error: image ${newName}:${newTag} not found`);
      }

      try {
        const harborImageUrl = await createHarborImageUrl(newName, newTag + tagPostfix, user.identityId, logger);

        await driver.withImageDriver(
          {
            clusterId: processClusterId,
            user: user.identityId,
          },
          async (imageDriver) => {
            await imageDriver.copyImage({
              imageId: id,
              sourcePath: sharedImage.path,
              newName,
              newTag,
              harborImageUrl,
              newImageId: image.id,
            });
          },
          logger,
        );

        image.status = Status.CREATED;
        image.path = harborImageUrl;
        await em.persistAndFlush(image);

        return;
      } catch (err: any) {
        image.failedReason = err.message;
        image.status = Status.FAILURE;
        em.persistAndFlush([image]);
        throw err;
      }
    };

    copyProcess();
    return image.id;
  });

export const getImageQuota = procedure
  .meta({
    openapi: {
      method: "GET",
      path: "/images/quota",
      tags: ["image"],
      summary: "get image quota",
    },
  })
  .input(z.void())
  .output(
    z.object({
      totalGB: z.number(),
      usedGB: z.number(),
    }),
  )
  .query(async ({ ctx: { user } }) => {
    const projectName = getUserHarborProjectName(user.identityId);

    const harborConfig = getHarborConfig();
    const harbor = new HarborClient(harborConfig);

    // 读取全局“Default disk space per project”
    async function fetchDefaultProjectQuota() {
      const res = await harbor.getHarborConfig();
      if (!res.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Harbor configurations error: ${res.status}`,
        });
      }
      const cfg = await res.json();

      // Harbor 配置里：
      // quota_per_project_enable: boolean，开启项目配额
      // storage_per_project: number，单位 GiB，-1 代表无限
      const enabled = cfg?.quota_per_project_enable;
      const storageGiB = cfg?.storage_per_project;

      // 未开启或值异常时，按无限处理（-1）
      const totalGB = typeof storageGiB === "number" ? (storageGiB === -1 ? -1 : +storageGiB.toFixed(2)) : -1;

      // 规范化：如果没启用也视为无限
      return {
        totalGB: enabled === false ? -1 : totalGB,
        usedGB: 0,
      };
    }

    // 读取项目 summary（存在时优先用真实数据）
    async function fetchProjectSummary(name: string) {
      const res = await harbor.getProjectSummary(name);

      if (!res.ok) {
        const err: any = new Error(`Harbor project summary error: ${res.status}`);
        err.status = res.status;
        throw err;
      }
      const data = await res.json();
      const hardBytes = data?.quota?.hard?.storage ?? null;
      const usedBytes = data?.quota?.used?.storage ?? null;

      return {
        totalGB: hardBytes != null ? bytesToGB(hardBytes) : 0,
        usedGB: usedBytes != null ? bytesToGB(usedBytes) : 0,
      };
    }

    try {
      return await fetchProjectSummary(projectName);
    } catch (e: any) {
      logger.error(`fetch project summary failed: ${e.message}`);

      // 兜底默认配额，避免接口直接失败
      return await fetchDefaultProjectQuota();
    }
  });

export const ImageCreationLogReqSchema = z.object({
  id: z.number(),
  skip: z.number(),
  lastQueriedOperation: z.nativeEnum(CreationOperation).optional(),
  limit: z.number().optional(),
});

export const ImageCreationLogResSchema = z.object({
  currentOperation: z.nativeEnum(CreationOperation),
  logChunk: z.string().optional(),
  totalResChunkSizeForCurrentOperation: z.number().optional(),
  isCompleted: z.boolean().optional(),
  isPushedCompleted: z.boolean().optional(),
});
export type ImageCreationLogRes = z.infer<typeof ImageCreationLogResSchema>;

const DEFAULT_CHUNK_SIZE = 4 * 1024 * 1024;

export const getImageCreationLog = procedure
  .meta({
    openapi: {
      method: "GET",
      path: "/image/{id}/creationLog",
      tags: ["image"],
      summary: "Get image creation log by id",
    },
  })
  .input(ImageCreationLogReqSchema)
  .output(ImageCreationLogResSchema)
  .query(async ({ input }) => {
    const { id, skip, limit, lastQueriedOperation } = input;
    const limitSkipSize = limit ? limit : DEFAULT_CHUNK_SIZE;

    const em = await forkEntityManager();
    // 不限制状态，因为日志展示过程中可能状态已变化
    const image = await em.findOne(Image, { id });

    if (!image) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Creating image ${id} not found`,
      });
    }

    const result = getCurrentImageCreationLog(id, skip, limitSkipSize, logger, lastQueriedOperation);

    return result;
  });
