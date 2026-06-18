import { plugin } from "@ddadaal/tsgrpc-server";
import { ServiceError } from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { UniqueConstraintViolationException } from "@mikro-orm/core";
import {
  JobTemplateServiceServer,
  JobTemplateServiceService,
  maxTimeUnitFromJSON,
  maxTimeUnitToJSON,
} from "@scow/protos/build/server/job_template";
import { JobTemplate, type MaxTimeUnit } from "src/entities/JobTemplate";

export const jobTemplateServiceServer = plugin((server) => {

  server.addService<JobTemplateServiceServer>(JobTemplateServiceService, {

    saveJobTemplate: async ({ request, em, logger }) => {
      const {
        userId, cluster, templateName, account,
        partition, qos, nodeCount, coreCount, gpuCount,
        maxTime, maxTimeUnit, memoryMb, command,
      } = request;

      logger.info("saveJobTemplate: user=%s, name=%s", userId, templateName);

      const template = new JobTemplate({
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
        command,
      });

      try {
        await em.persistAndFlush(template);
      } catch (e) {
        if (e instanceof UniqueConstraintViolationException) {
          throw {
            code: Status.ALREADY_EXISTS,
            message: `Template name "${templateName}" already exists for user ${userId}`,
          } as ServiceError;
        }
        throw e;
      }

      return [{ id: template.id }];
    },

    listJobTemplates: async ({ request, em, logger }) => {
      const { userId } = request;

      logger.info("listJobTemplates: user=%s", userId);

      const templates = await em.find(JobTemplate, { userId }, {
        orderBy: { createdAt: "DESC" },
      });

      return [{
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
          command: t.command,
          createdAt: t.createdAt.toISOString(),
        })),
      }];
    },

    deleteJobTemplate: async ({ request, em, logger }) => {
      const { userId, id } = request;

      logger.info("deleteJobTemplate: user=%s, id=%d", userId, id);

      const template = await em.findOne(JobTemplate, { userId, id });

      if (!template) {
        throw {
          code: Status.NOT_FOUND,
          message: `Template with id ${id} not found`,
        } as ServiceError;
      }

      await em.removeAndFlush(template);

      return [{}];
    },

    renameJobTemplate: async ({ request, em, logger }) => {
      const { userId, id, newName } = request;

      logger.info("renameJobTemplate: user=%s, id=%d, newName=%s", userId, id, newName);

      const template = await em.findOne(JobTemplate, { id });

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
