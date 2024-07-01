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

import { ServiceError } from "@grpc/grpc-js";
import { getSortedClusterIds } from "@scow/config/build/cluster";
import { OperationResult, OperationType } from "@scow/lib-operation-log";
import { sshConnect as libConnect } from "@scow/lib-ssh";
import { TRPCError } from "@trpc/server";
import { aiConfig } from "src/server/config/ai";
import { rootKeyPair } from "src/server/config/env";
import { Image, Source, Status } from "src/server/entities/Image";
import { callLog } from "src/server/setup/operationLog";
import { procedure } from "src/server/trpc/procedure/base";
import { clusterNotFound } from "src/server/utils/errors";
import { forkEntityManager } from "src/server/utils/getOrm";
import { createHarborImageUrl, getLoadedImage, getPulledImage, pushImageToHarbor } from "src/server/utils/image";
import { logger } from "src/server/utils/logger";
import { paginationProps } from "src/server/utils/orm";
import { paginationSchema } from "src/server/utils/pagination";
import { checkSharePermission } from "src/server/utils/share";
import { getClusterLoginNode } from "src/server/utils/ssh";
import { parseIp } from "src/utils/parse";
import { z } from "zod";

import { clusters } from "../config";
import { booleanQueryParam, clusterExist } from "../utils";

class NoClusterError extends TRPCError {
  constructor(name: string, tag: string) {
    super({
      code: "NOT_FOUND",
      message: `Image ${name}:${tag} create failed: there is no available cluster`,
    });
  }
};

class InternalServerError extends TRPCError {
  constructor(errMessage: string, process: "Create" | "Copy") {
    super({
      code: "INTERNAL_SERVER_ERROR",
      message: `${process} image failed, ${errMessage}`,
    });
  }
}

export const ImageListSchema = z.object({
  id: z.number(),
  name: z.string(),
  owner: z.string(),
  source: z.nativeEnum(Source),
  tag: z.string(),
  description: z.string().optional(),
  path: z.string().optional(),
  sourcePath: z.string().optional(),
  status: z.nativeEnum(Status),
  isShared: z.boolean(),
  clusterId: z.string().optional(),
  createTime: z.string().optional(),
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
  .input(z.object({
    ...paginationSchema.shape,
    nameOrTagOrDesc: z.string().optional(),
    isPublic: booleanQueryParam().optional(),
    clusterId: z.string().optional(),
    withExternal: booleanQueryParam().optional(),
  }))
  .output(z.object({ items: z.array(ImageListSchema), count: z.number() }))
  .query(async ({ input, ctx:{ user } }) => {

    const { clusterId, isPublic, nameOrTagOrDesc, withExternal, pageSize, page } = input;
    const em = await forkEntityManager();

    const isPublicQuery = isPublic ? {
      isShared: true,
      owner: { $ne: null },
    } : { owner: user.identityId };

    const nameOrTagOrDescQuery = nameOrTagOrDesc ? {
      $or: [
        { name: { $like: `%${nameOrTagOrDesc}%` } },
        { tag: { $like: `%${nameOrTagOrDesc}%` } },
        { description: { $like: `%${nameOrTagOrDesc}%` } },
      ],
    } : {};

    const [items, count] = await em.findAndCount(Image, {
      $and: [
        nameOrTagOrDescQuery,
        isPublicQuery,
        input.clusterId ? (withExternal ? { $or: [{ clusterId }, { clusterId: { $eq: null } }]} : { clusterId }) : {},
      ],
    }, {
      ...paginationProps(page, pageSize),
      orderBy: { createTime: "desc" },
    });

    return { items: items.map((x) => {
      return {
        id: x.id,
        name: x.name,
        owner: x.owner,
        source: x.source,
        tag: x.tag,
        description: x.description,
        path: x.path,
        sourcePath: x.sourcePath,
        status: x.status,
        isShared: Boolean(x.isShared),
        clusterId: x.clusterId,
        createTime: x.createTime ? x.createTime.toISOString() : undefined,
      }; }), count };
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
  .input(z.object({
    name: z.string(),
    tag: z.string(),
    description: z.string().optional(),
    source: z.enum([Source.INTERNAL, Source.EXTERNAL]),
    sourcePath: z.string(),
    clusterId: z.string().optional(),
  }))
  .output(z.number())
  .use(async ({ input:{ clusterId, tag }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.createImage,
    };

    if (res.ok) {
      await callLog({ ...logInfo, operationTypePayload:{ clusterId:clusterId ?? "", tag, imageId:res.data as number } },
        OperationResult.SUCCESS);
    }

    if (!res.ok) {
      await callLog({ ...logInfo, operationTypePayload:{ clusterId:clusterId ?? "" } },
        OperationResult.FAIL);
    }

    return res;
  })
  .mutation(async ({ input, ctx: { user } }) => {

    if (input.clusterId && !clusterExist(input.clusterId)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Cluster id ${input.clusterId} does not exist.`,
      });
    }
    const em = await forkEntityManager();
    const { name, tag, source, sourcePath } = input;

    const imageNameTagExist = await em.findOne(Image, {
      name, tag, owner: user.identityId });

    if (imageNameTagExist) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `Image's name ${name} with tag ${tag} already exist`,
      });
    };

    // 获取加载镜像的集群节点，如果是远程镜像则使用优先级最高的集群作为本地处理镜像的节点
    const processClusterId = input.source === Source.INTERNAL ? input.clusterId : getSortedClusterIds(clusters)[0];

    if (!processClusterId) { throw new NoClusterError(name, tag); }

    const host = getClusterLoginNode(processClusterId);
    if (!host) { throw clusterNotFound(processClusterId); };

    const harborImageUrl = createHarborImageUrl(name, tag, user.identityId);

    // 创建一个状态为 creating 的数据
    const image = new Image({
      ...input, path: harborImageUrl, status: Status.CREATING, owner: user.identityId,
    });
    await em.persistAndFlush([image]);

    const createProcess = async () => {
      const em = await forkEntityManager();
      const image = await em.findOne(Image, { name, tag, owner: user.identityId });

      if (!image) {
        throw new Error(`copyImage error: image ${name}:${tag} not found`);
      }

      try {
        await libConnect(host, "root", rootKeyPair, logger, async (ssh) => {

          let localImageUrl: string | undefined = undefined;
          if (source === Source.INTERNAL) {
            // 本地镜像检查源文件拥有者权限
            await checkSharePermission({ ssh, logger, sourcePath: sourcePath, userId: user.identityId });
            // 检查是否为tar文件
            if (!sourcePath.endsWith(".tar")) {
              throw new Error(`Image ${name}:${tag} create failed: image is not a tar file`);
            }

            // 本地镜像时加载镜像
            localImageUrl = await getLoadedImage({
              ssh,
              clusterId: processClusterId,
              logger,
              sourcePath,
            }).catch((e) => {
              const ex = e as ServiceError;
              throw new Error(`createImage failed, ${ex.message}`);
            });
          } else {
            // 远程镜像需先拉取到本地
            localImageUrl = await getPulledImage({
              ssh,
              clusterId: processClusterId,
              logger,
              sourcePath,
            }).catch((e) => {
              const ex = e as ServiceError;
              throw new Error(`createImage failed, ${ex.message}`);
            });
          };

          if (localImageUrl === undefined) {
            throw new Error(`Image ${name}:${tag} create failed: localImage not found`);
          }

          // 制作镜像，上传至harbor
          await pushImageToHarbor({
            ssh,
            clusterId: processClusterId,
            logger,
            localImageUrl,
            harborImageUrl,
          }).catch((e) => {
            const ex = e as ServiceError;
            throw new Error(`createImage failed, ${ex.message}`);
          });

          // 更新数据库
          image.status = Status.CREATED;
          await em.persistAndFlush(image);

          return;

        });
      } catch {
        image.status = Status.FAILURE;
        await em.persistAndFlush(image);
      };

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
  .input(z.object({
    id: z.number(),
    description: z.string().optional(),
  }))
  .output(z.number())
  .use(async ({ input:{ id }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.updateImage,
    };

    if (res.ok) {
      await callLog({ ...logInfo, operationTypePayload:{ imageId:id } },
        OperationResult.SUCCESS);
    }

    if (!res.ok) {
      await callLog({ ...logInfo, operationTypePayload:{ imageId:id } },
        OperationResult.FAIL);
    }

    return res;
  })
  .mutation(
    async ({ input, ctx: { user } }) => {
      const em = await forkEntityManager();

      const image = await em.findOne(Image, { id: input.id });
      if (!image) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Image ${input.id} not found`,
        });
      };

      if (image.owner !== user.identityId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Image ${input.id} not accessible`,
        });
      }
      image.description = input.description;

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
  .input(z.object({ id: z.number(), force: booleanQueryParam().optional() }))
  .output(z.void())
  .use(async ({ input:{ id }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.deleteImage,
    };

    if (res.ok) {
      await callLog({ ...logInfo, operationTypePayload:{ imageId:id } },
        OperationResult.SUCCESS);
    }

    if (!res.ok) {
      await callLog({ ...logInfo, operationTypePayload:{ imageId:id } },
        OperationResult.FAIL);
    }

    return res;
  })
  .mutation(async ({ input, ctx: { user } }) => {
    const em = await forkEntityManager();
    const image = await em.findOne(Image, { id: input.id });

    if (!image) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Image ${input.id} not found`,
      });
    }

    if (!input.force && image.status === Status.CREATING) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Image ${image.name}:${image.tag} is still being creating.`,
      });
    }

    if (image.owner !== user.identityId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Image ${image.name}:${image.tag} not accessible`,
      });
    }

    // 获取harbor中的reference以删除镜像
    const getReferenceUrl = `${aiConfig.harborConfig.protocol}://${aiConfig.harborConfig.url}/api/v2.0/projects`
    + `/${aiConfig.harborConfig.project}/repositories/${user.identityId}%252F${image.name}/artifacts`;
    const getReferenceRes = await fetch(getReferenceUrl, {
      method: "GET",
      headers: {
        "content-type": "application/json",
      },
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
        const errorMessage = errorBody.errors.map((i: {message?: string}) => i.message).join();
        logger.error("Failed to get image reference url %s: %s", getReferenceUrl, errorMessage);
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

    // 判断是否是唯一的标签，如果是需要删除上级的特定Artifact
    let needDeleteArtifact: boolean = false;

    for (const item of referenceRes) {
      if (item.tags?.length > 0 && item.tags.find((i: { name: string }) => i.name === image.tag)) {
        reference = item.digest;
        needDeleteArtifact = (item.tags.length === 1);
      }
    }

    if (!reference) {
      // Harbor API 请求接收到正常返回值，但是在Harbor中没有找到对应镜像，则直接删除本地数据库镜像信息
      logger.error(`Maybe image(${input.id}) ${image.name}:${image.tag} not exist on harbor`);
      await em.removeAndFlush(image);
      return;
    }

    const authInfo = Buffer.from(`${aiConfig.harborConfig.user}:${aiConfig.harborConfig.password}`).toString("base64");

    // 如果上面的tag是最相同imageName下相同镜像的最后一个标签，则删除整个Artifact
    if (needDeleteArtifact) {

      const deleteArtifactUrl = `${aiConfig.harborConfig.protocol}://${aiConfig.harborConfig.url}/api/v2.0/projects`
      + `/${aiConfig.harborConfig.project}/repositories/${user.identityId}%252F${image.name}`
      + `/artifacts/${reference}`;

      const deleteArtifact = await fetch(deleteArtifactUrl, {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
          "Accept": "application/json",
          "Authorization": `Basic ${authInfo}`,
        },
      });
      // harbor 删除出错，但状态本身就是失败时无需操作
      if (!deleteArtifact.ok) {
        const errorBody = await deleteArtifact.json();
        // 来自harbor的错误信息
        const errorMessage = errorBody.errors.map((i: {message?: string}) => i.message).join();
        logger.error("Failed to delete image artifact url %s", deleteArtifactUrl);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete image tag: " + errorMessage,
        });
      }

    // 如果上面的tag不是最相同imageName下相同镜像的最后一个标签，则只删除该标签
    } else {
      const deleteUrl = `${aiConfig.harborConfig.protocol}://${aiConfig.harborConfig.url}/api/v2.0/projects`
      + `/${aiConfig.harborConfig.project}/repositories/${user.identityId}%252F${image.name}`
      + `/artifacts/${reference}/tags/${image.tag}`;

      const deleteRes = await fetch(deleteUrl, {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
          "Accept": "application/json",
          "Authorization": `Basic ${authInfo}`,
        },
      });
      // harbor 删除出错，但状态本身就是失败时无需操作
      if (!deleteRes.ok) {
        const errorBody = await deleteRes.json();
        // 来自harbor的错误信息
        const errorMessage = errorBody.errors.map((i: {message?: string}) => i.message).join();
        logger.error("Failed to delete image tag url %s", deleteUrl);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete image tag: " + errorMessage,
        });
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
  .input(z.object({ id: z.number(), share: z.boolean() }))
  .output(z.void())
  .use(async ({ input:{ id, share }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.shareImage,
    };

    if (share && res.ok) {
      await callLog({ ...logInfo, operationTypePayload:{ imageId:id } },
        OperationResult.SUCCESS);
    }

    if (share && !res.ok) {
      await callLog({ ...logInfo, operationTypePayload:{ imageId:id } },
        OperationResult.FAIL);
    }

    return res;
  })
  .mutation(async ({ input, ctx: { user } }) => {
    const em = await forkEntityManager();
    const image = await em.findOne(Image, { id: input.id });

    if (!image) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Image ${input.id} not found`,
      });
    };

    if (image.status === Status.CREATING) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Image ${input.id} is still being creating.`,
      });
    }

    if (image.owner !== user.identityId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Image ${input.id} not accessible`,
      });
    }

    image.isShared = input.share;

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
  .input(z.object({ id: z.number(), newName: z.string(), newTag: z.string() }))
  .output(z.number())
  .use(async ({ input:{ id, newTag }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.copyImage,
    };

    if (res.ok) {
      await callLog({ ...logInfo, operationTypePayload:
        { sourceImageId:id, targetImageId:res.data as number, targetImageTag:newTag } },
      OperationResult.SUCCESS);
    }

    if (!res.ok) {
      await callLog({ ...logInfo, operationTypePayload:
        { sourceImageId:id } },
      OperationResult.FAIL);
    }

    return res;
  })
  .mutation(async ({ input, ctx: { user } }) => {

    const em = await forkEntityManager();

    const { id, newName, newTag } = input;

    const sharedImage = await em.findOne(Image, { id, isShared: true, status: Status.CREATED });

    if (!sharedImage) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Shared Image ${id} not found`,
      });
    };

    if (!sharedImage.path || !sharedImage.sourcePath) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Shared Image ${id} do not have path or sourcePath`,
      });
    }

    const imageNameTagsExist = await em.findOne(Image,
      { name: newName, tag: newTag, owner: user.identityId });
    if (imageNameTagsExist) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `Image's name ${newName} with tag ${newTag} already exist`,
      });
    };

    // 数据库创建一条状态为创建中的数据
    const image = new Image({
      name: newName,
      tag: newTag,
      owner: user.identityId,
      source: Source.EXTERNAL,
      sourcePath: sharedImage.path,
      status: Status.CREATING,
      description: sharedImage.description,
    });
    await em.persistAndFlush(image);

    const processClusterId = getSortedClusterIds(clusters)[0];
    if (!processClusterId) { throw new NoClusterError(newName, newTag); }

    const host = getClusterLoginNode(processClusterId);
    if (!host) { throw clusterNotFound(processClusterId); };

    const copyProcess = async () => {
      const em = await forkEntityManager();
      const image = await em.findOne(Image, { name: newName, tag: newTag, owner: user.identityId });

      if (!image) {
        throw new Error(`copyImage error: image ${newName}:${newTag} not found`);
      }

      try {
        await libConnect(host, "root", rootKeyPair, logger, async (ssh) => {
          // 拉取远程镜像
          if (sharedImage.path === undefined) {
            throw new Error(`copyImage error: shared image ${id} do not have path`);
          }
          const localImageUrl = await getPulledImage({
            ssh,
            clusterId: processClusterId,
            logger,
            sourcePath:
            sharedImage.path,
          })
            .catch((e) => {
              const ex = e as ServiceError;
              throw new InternalServerError(ex.message, "Copy");
            });
          if (!localImageUrl) {
            throw new Error(`copyImage Error: Image ${newName}:${newTag} create failed: localImage not found`);
          }

          const harborImageUrl = createHarborImageUrl(newName, newTag, user.identityId);

          // 制作镜像上传
          await pushImageToHarbor({
            ssh,
            clusterId: processClusterId,
            logger,
            localImageUrl,
            harborImageUrl,
          }).catch((e) => {
            const ex = e as ServiceError;
            throw new Error(`copyImage failed, ${ex.message}`);
          });

          image.status = Status.CREATED;
          image.path = harborImageUrl;
          await em.persistAndFlush(image);

          return;

        });
      } catch {
        image.status = Status.FAILURE;
        em.persistAndFlush([image]);
      }
    };

    copyProcess();
    return image.id;

  });
