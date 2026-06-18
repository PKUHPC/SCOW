import type { MaxTimeUnit } from "src/entities/JobTemplate";

import { plugin } from "@ddadaal/tsgrpc-server";
import { ServiceError } from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { UniqueConstraintViolationException } from "@mikro-orm/core";
import { AppTemplateServiceServer, AppTemplateServiceService } from "@scow/protos/build/server/app_template";
import { maxTimeUnitFromJSON, maxTimeUnitToJSON } from "@scow/protos/build/server/job_template";
import { AppTemplate } from "src/entities/AppTemplate";

export const appTemplateServiceServer = plugin((server) => {
  server.addService<AppTemplateServiceServer>(AppTemplateServiceService, {
    saveAppTemplate: async ({ request, em, logger }) => {
      const {
        userId,
        cluster,
        templateName,
        account,
        partition,
        qos,
        nodeCount,
        coreCount,
        gpuCount,
        maxTime,
        maxTimeUnit,
        memoryMb,
        appId,
        customAttributes,
      } = request;

      logger.info("saveAppTemplate: user=%s, name=%s, appId=%s", userId, templateName, appId);

      const template = new AppTemplate({
        userId,
        cluster,
        templateName,
        account,
        partition,
        qos,
        nodeCount,
        coreCount,
        gpuCount,
        maxTime,
        maxTimeUnit: maxTimeUnitToJSON(maxTimeUnit) as MaxTimeUnit,
        memoryMb,
        appId,
        customAttributes: customAttributes ? JSON.parse(customAttributes) : undefined,
      });

      try {
        await em.persistAndFlush(template);
      } catch (e) {
        if (e instanceof UniqueConstraintViolationException) {
          throw {
            code: Status.ALREADY_EXISTS,
            message: `Template name "${templateName}" already exists for user ${userId} in cluster ${cluster}`,
          } as ServiceError;
        }
        throw e;
      }

      return [{ id: template.id }];
    },

    listAppTemplates: async ({ request, em, logger }) => {
      const { userId, appId, cluster } = request;

      logger.info("listAppTemplates: user=%s, appId=%s, cluster=%s", userId, appId, cluster);

      const templates = await em.find(
        AppTemplate,
        { userId, cluster, appId },
        {
          orderBy: { createdAt: "DESC" },
        },
      );

      return [
        {
          templates: templates.map((t) => ({
            id: t.id,
            templateName: t.templateName,
            cluster: t.cluster,
            account: t.account,
            partition: t.partition,
            qos: t.qos,
            nodeCount: t.nodeCount,
            coreCount: t.coreCount,
            gpuCount: t.gpuCount,
            maxTime: t.maxTime,
            maxTimeUnit: maxTimeUnitFromJSON(t.maxTimeUnit),
            memoryMb: t.memoryMb,
            appId: t.appId,
            customAttributes: t.customAttributes ? JSON.stringify(t.customAttributes) : undefined,
            createdAt: t.createdAt.toISOString(),
          })),
        },
      ];
    },

    deleteAppTemplate: async ({ request, em, logger }) => {
      const { userId, id } = request;

      logger.info("deleteAppTemplate: user=%s, id=%d", userId, id);

      const template = await em.findOne(AppTemplate, { id, userId });

      if (!template) {
        throw {
          code: Status.NOT_FOUND,
          message: `Template with id ${id} not found`,
        } as ServiceError;
      }

      await em.removeAndFlush(template);

      return [{}];
    },

    renameAppTemplate: async ({ request, em, logger }) => {
      const { userId, id, newName } = request;

      logger.info("renameAppTemplate: user=%s, id=%d, newName=%s", userId, id, newName);

      const template = await em.findOne(AppTemplate, { id });

      if (!template) {
        throw {
          code: Status.NOT_FOUND,
          message: `Template with id ${id} not found`,
        } as ServiceError;
      }

      if (template.userId !== userId) {
        throw {
          code: Status.PERMISSION_DENIED,
          message: `Template ${id} does not belong to user ${userId}`,
        } as ServiceError;
      }

      template.templateName = newName;

      try {
        await em.flush();
      } catch (e) {
        if (e instanceof UniqueConstraintViolationException) {
          throw {
            code: Status.ALREADY_EXISTS,
            message: `Template name "${newName}" already exists for user ${userId}`,
          } as ServiceError;
        }
        throw e;
      }

      return [{}];
    },
  });
});
