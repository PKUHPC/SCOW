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

import { getSortedClusterIds } from "@scow/config/build/cluster";
import { OperationResult, OperationType } from "@scow/lib-operation-log";
import { TRPCError } from "@trpc/server";
import dayjs from "dayjs";
import { aiConfig } from "src/server/config/ai";
import { Image, ImageType, Source, Status } from "src/server/entities/Image";
import { callLog } from "src/server/setup/operationLog";
import { procedure } from "src/server/trpc/procedure/base";
import { checkClusterAvailable } from "src/server/utils/clusters";
import { forkEntityManager } from "src/server/utils/getOrm";
import { createHarborImageUrl, isValidImageAddress } from "src/server/utils/image";
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
};

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
  types:z.array(z.enum([ImageType.APP, ImageType.TRAIN,ImageType.INFER])),
  inferServicePort:z.string().optional(),
  startCommand:z.string().optional(),
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
    // GET请求不能传array类型
    types: z.string().optional().default(""),
  }))
  .output(z.object({ items: z.array(ImageListSchema), count: z.number() }))
  .query(async ({ input, ctx:{ user } }) => {

    const { clusterId, isPublic, nameOrTagOrDesc, withExternal,types:rawTypes, pageSize, page } = input;

    const types = rawTypes
      ? rawTypes.split(",").filter((t): t is ImageType =>
        Object.values(ImageType).includes(t as ImageType))
      : [];

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

    const typesQuery = types.length > 0
      ? {
        $or: types.map((type) => ({
          types: { $like: `%${type}%` },
        })),
      }
      : {};

    const [items, count] = await em.findAndCount(Image, {
      $and: [
        nameOrTagOrDescQuery,
        isPublicQuery,
        typesQuery,
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
        types:x.types ?? [],
        inferServicePort:x.inferServicePort,
        startCommand:x.startCommand,
      }; }), count };
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
  .input(z.object({
    imageId:z.number(),
  }))
  .output(z.object({
    types:z.array(z.enum([ImageType.APP, ImageType.TRAIN,ImageType.INFER])),
    inferServicePort:z.string().optional(),
    startCommand:z.string().optional(),
  }))
  .query(async ({ input:{ imageId } }) => {
    const em = await forkEntityManager();

    const image = await em.findOne(Image, {
      id:imageId,
    });

    if (!image) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Image ${imageId} not found`,
      });
    };

    return {
      types:image.types ?? [],
      inferServicePort:image.inferServicePort,
      startCommand:image.startCommand,
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
  .input(z.object({
    name: z.string(),
    tag: z.string(),
    description: z.string().optional(),
    source: z.enum([Source.INTERNAL, Source.EXTERNAL]),
    sourcePath: z.string(),
    clusterId: z.string(),
    userName:z.string().optional(),
    password:z.string().optional(),
    types:z.array(z.enum([ImageType.APP, ImageType.TRAIN,ImageType.INFER])),
    inferServicePort:z.string().optional(),
    startCommand:z.string().optional(),
  }))
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
    const { name, tag, source, sourcePath, userName, password } = input;

    if (source === Source.EXTERNAL && !isValidImageAddress(sourcePath)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `SourcePath ${sourcePath} is not valid.`,
      });
    }

    // tag的唯一标识符
    const tagPostfix = dayjs().unix().toString();

    const imageNameTagExist = await em.findOne(Image, {
      name, tag, owner: user.identityId });

    if (imageNameTagExist) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `Image's name ${name} with tag ${tag} already exist`,
      });
    };

    // 获取加载镜像的集群节点
    const processClusterId = input.clusterId;

    if (!processClusterId) { throw new NoClusterError(name, tag); }
    checkClusterAvailable(currentClusterIds, processClusterId);

    const harborImageUrl = createHarborImageUrl(name, tag + tagPostfix, user.identityId);

    // 创建一个状态为 creating 的数据
    const image = new Image({
      ...input,
      path: harborImageUrl,
      status: Status.CREATING,
      owner: user.identityId,
      tagPostfix,
    });
    await em.persistAndFlush([image]);

    const createProcess = async () => {
      const em = await forkEntityManager();
      const image = await em.findOne(Image, { name, tag, owner: user.identityId });

      if (!image) {
        throw new Error(`copyImage error: image ${name}:${tag} not found`);
      }

      const logInfo = {
        operatorUserId: user.identityId,
        operatorIp: parseIp(req) ?? "",
        operationTypeName: OperationType.createImage,
      };

      try {
        await driver.withImageDriver({
          clusterId:processClusterId,
          user:user.identityId,
        },async (imageDriver) => {
          await imageDriver.createImage({
            source,
            sourcePath,
            name,
            tag,
            loginInfo:{ userName,password },
            harborImageUrl,
          });
        },logger);

        // 更新数据库
        image.status = Status.CREATED;
        await em.persistAndFlush(image);

        await callLog({ ...logInfo, operationTypePayload:
          {
            clusterId:input.clusterId,
            tag,
            imageId:image.id,
            imageName:name,
          },
        },
        OperationResult.SUCCESS);

        return;
      } catch (err) {
        image.status = Status.FAILURE;
        await em.persistAndFlush(image);

        await callLog({ ...logInfo, operationTypePayload:
          {
            clusterId:input.clusterId,
            tag,
            imageName:name,
          },
        },
        OperationResult.FAIL);
        throw err;
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
    types:z.array(z.enum([ImageType.APP, ImageType.TRAIN,ImageType.INFER])),
    inferServicePort:z.string().optional(),
    startCommand:z.string().optional(),
  }))
  .output(z.number())
  .use(async ({ input:{ id }, ctx, next }) => {
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
    };

    const res = await next({ ctx });

    if (res.ok) {
      await callLog({ ...logInfo,
        operationTypePayload:{
          imageId:id,
          clusterId:image.clusterId ?? "",
          imageName:image.name,
          tag:image.tag,
        },
      },
      OperationResult.SUCCESS);
    }

    if (!res.ok) {
      await callLog({ ...logInfo,
        operationTypePayload:{
          imageId:id ,
          clusterId:image.clusterId ?? "",
          imageName:image.name,
          tag:image.tag,
        },
      },
      OperationResult.FAIL);
    }

    return res;
  })
  .mutation(
    async ({ input:{ id,description,types,inferServicePort,startCommand }, ctx: { user } }) => {
      const em = await forkEntityManager();

      const image = await em.findOne(Image, { id: id });
      if (!image) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Image ${id} not found`,
        });
      };

      if (image.owner !== user.identityId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Image ${id} not accessible`,
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
  .input(z.object({ id: z.number(), force: booleanQueryParam().optional() }))
  .output(z.void())
  .use(async ({ input:{ id }, ctx, next }) => {
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
    };

    const res = await next({ ctx });

    if (res.ok) {
      await callLog({ ...logInfo,
        operationTypePayload:{
          imageId:id,
          clusterId:image.clusterId ?? "",
          imageName:image.name,
          tag:image.tag,
        },
      },
      OperationResult.SUCCESS);
    }

    if (!res.ok) {
      await callLog({ ...logInfo,
        operationTypePayload:{
          imageId:id ,
          clusterId:image.clusterId ?? "",
          imageName:image.name,
          tag:image.tag,
        },
      },
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
        const errorMessage = errorBody.errors.map((i: { message?: string }) => i.message).join();
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
      if (item.tags?.length > 0 && item.tags.find((i: { name: string }) =>
        i.name === image.tag + (image.tagPostfix ?? ""))) {
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
        const errorMessage = errorBody.errors.map((i: { message?: string }) => i.message).join();
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
      + `/artifacts/${reference}/tags/${image.tag + (image.tagPostfix ?? "")}`;

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
        const errorMessage = errorBody.errors.map((i: { message?: string }) => i.message).join();
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
    };

    const res = await next({ ctx });

    if (share && res.ok) {
      await callLog({ ...logInfo,
        operationTypePayload:{
          imageId:id,
          clusterId:image.clusterId ?? "",
          imageName:image.name,
          tag:image.tag,
        },
      },
      OperationResult.SUCCESS);
    }

    if (share && !res.ok) {
      await callLog({ ...logInfo,
        operationTypePayload:{
          imageId:id,
          clusterId:image.clusterId ?? "",
          imageName:image.name,
          tag:image.tag,
        },
      },
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
  .input(z.object(
    {
      id: z.number(),
      newName: z.string(),
      newTag: z.string(),
      clusterId:z.optional(z.string()),
      newTypes:z.array(z.enum([ImageType.APP, ImageType.TRAIN,ImageType.INFER])),
      newInferServicePort:z.string().optional(),
      newStartCommand:z.string().optional(),
      newDescription:z.string().optional(),
    },
  ))
  .output(z.number())
  .use(async ({ input:{ id, newTag,newName,clusterId }, ctx, next }) => {
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
    };

    const res = await next({ ctx });

    if (res.ok) {
      await callLog({ ...logInfo,
        operationTypePayload:
        { sourceImageId:id,
          targetImageId:res.data as number,
          targetImageTag:newTag,
          targetImageName:newName,
          clusterId:clusterId ?? "",
          sourceImageName:image.name,
          sourceImageTag:image.tag,
        },
      },
      OperationResult.SUCCESS);
    }

    if (!res.ok) {
      await callLog({ ...logInfo,
        operationTypePayload:
        { sourceImageId:id,
          targetImageTag:newTag,
          targetImageName:newName,
          clusterId:clusterId ?? "",
          sourceImageName:image.name,
          sourceImageTag:image.tag,
        },
      },
      OperationResult.FAIL);
    }

    return res;
  })
  .mutation(async ({ input, ctx: { user } }) => {

    const em = await forkEntityManager();

    const { id, newName, newTag, clusterId,newTypes,newInferServicePort,newStartCommand,newDescription } = input;

    // tag的唯一标识符
    const tagPostfix = dayjs().unix().toString();

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
      tagPostfix,
      owner: user.identityId,
      source: Source.EXTERNAL,
      sourcePath: sharedImage.path,
      status: Status.CREATING,
      description: newDescription,
      clusterId,
      types:newTypes,
      inferServicePort:newInferServicePort,
      startCommand:newStartCommand,
    });
    await em.persistAndFlush(image);

    // 使用原来镜像的集群，防止集群架构不同
    const processClusterId = clusterId ?? getSortedClusterIds(clusters)[0];

    if (!processClusterId) { throw new NoClusterError(newName, newTag); }

    const currentClusterIds = await getCurrentClusters(user.identityId);
    checkClusterAvailable(currentClusterIds, processClusterId);

    const copyProcess = async () => {
      const em = await forkEntityManager();
      const image = await em.findOne(Image, { name: newName, tag: newTag, owner: user.identityId });

      if (!image) {
        throw new Error(`copyImage error: image ${newName}:${newTag} not found`);
      }

      try {
        const harborImageUrl = createHarborImageUrl(newName, newTag + tagPostfix, user.identityId);

        await driver.withImageDriver({
          clusterId:processClusterId,
          user:user.identityId,
        },async (imageDriver) => {
          await imageDriver.copyImage({
            imageId:id,
            sourcePath:sharedImage.path,
            newName,
            newTag,
            harborImageUrl,
          });
        },
        logger);

        image.status = Status.CREATED;
        image.path = harborImageUrl;
        await em.persistAndFlush(image);

        return;
      } catch (err: any) {
        image.status = Status.FAILURE;
        em.persistAndFlush([image]);
        throw err;
      }
    };

    copyProcess();
    return image.id;

  });
