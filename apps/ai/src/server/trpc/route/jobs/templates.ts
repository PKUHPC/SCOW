import { TRPCError } from "@trpc/server";
import { JobType } from "src/models/Job";
import { JobTemplate } from "src/server/entities/JobTemplate";
import { procedure } from "src/server/trpc/procedure/base";
import { forkEntityManager } from "src/server/utils/getOrm";
import { z } from "zod";

import { DevSubmitRecordFormDataSchema } from "../devHost/devHost";
import { AppSubmitRecordFormDataSchema } from "./apps";
import { InferSubmitRecordFormDataSchema } from "./infer";
import { TrainSubmitRecordFormDataSchema } from "./jobs";

const MaxTimeUnitSchema = z.enum(["min", "hour", "day"]).optional();
const AccountSchema = z.string().optional();

export const AppTemplateFormDataSchema = AppSubmitRecordFormDataSchema
  .omit({ appJobName: true }).extend({ maxTimeUnit: MaxTimeUnitSchema, account: AccountSchema });
export const TrainTemplateFormDataSchema = TrainSubmitRecordFormDataSchema
  .omit({ trainJobName: true }).extend({
    maxTimeUnit: MaxTimeUnitSchema,
    account: AccountSchema,
    nodeUnitCount: z.number().optional(),
  });
export const InferTemplateFormDataSchema = InferSubmitRecordFormDataSchema
  .omit({ InferenceJobName: true }).extend({
    maxTimeUnit: MaxTimeUnitSchema,
    account: AccountSchema,
    maxTimeUnlimited: z.boolean().optional(),
  });
export const DevTemplateFormDataSchema = DevSubmitRecordFormDataSchema
  .omit({ devHostName: true }).extend({
    account: AccountSchema,
    gpuType: z.string().optional(),
  });

export const TemplateFormDataSchema = z.union([
  AppTemplateFormDataSchema,
  DevTemplateFormDataSchema,
  InferTemplateFormDataSchema,
  TrainTemplateFormDataSchema,
]);

export type TemplateFormData = z.infer<typeof TemplateFormDataSchema>;
export type AppTemplateFormData = z.infer<typeof AppTemplateFormDataSchema>;
export type TrainTemplateFormData = z.infer<typeof TrainTemplateFormDataSchema>;
export type InferTemplateFormData = z.infer<typeof InferTemplateFormDataSchema>;
export type DevTemplateFormData = z.infer<typeof DevTemplateFormDataSchema>;

// ── Shared output schema ──────────────────────────────────────────

const templateItemBase = {
  id: z.number(),
  templateName: z.string(),
  appId: z.string(),
  cluster: z.string(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
};

const AppTemplateItemSchema = z.object({
  ...templateItemBase,
  jobType: z.literal(JobType.APP),
  formData: AppTemplateFormDataSchema,
});

const DevTemplateItemSchema = z.object({
  ...templateItemBase,
  jobType: z.literal(JobType.DEV_HOST),
  formData: DevTemplateFormDataSchema,
});

const TrainTemplateItemSchema = z.object({
  ...templateItemBase,
  jobType: z.literal(JobType.TRAIN),
  formData: TrainTemplateFormDataSchema,
});

const InferTemplateItemSchema = z.object({
  ...templateItemBase,
  jobType: z.literal(JobType.INFER),
  formData: InferTemplateFormDataSchema,
});

const TemplateItemSchema = z.discriminatedUnion("jobType", [
  AppTemplateItemSchema,
  DevTemplateItemSchema,
  TrainTemplateItemSchema,
  InferTemplateItemSchema,
]);

export type TemplateItem = z.infer<typeof TemplateItemSchema>;
export type SaveTemplateInput = z.infer<typeof SaveTemplateInputSchema>;

const saveTemplateBase = {
  templateName: z.string().min(1).max(100),
  appId: z.string().optional(),
  cluster: z.string(),
};

const SaveTemplateInputSchema = z.discriminatedUnion("jobType", [
  z.object({ ...saveTemplateBase, jobType: z.literal(JobType.APP), formData: AppTemplateFormDataSchema }),
  z.object({ ...saveTemplateBase, jobType: z.literal(JobType.DEV_HOST), formData: DevTemplateFormDataSchema }),
  z.object({ ...saveTemplateBase, jobType: z.literal(JobType.TRAIN), formData: TrainTemplateFormDataSchema }),
  z.object({ ...saveTemplateBase, jobType: z.literal(JobType.INFER), formData: InferTemplateFormDataSchema }),
]);

export const saveTemplate = procedure
  .input(SaveTemplateInputSchema)
  .output(z.object({ id: z.number() }))
  .mutation(async ({ input, ctx: { user } }) => {
    const { templateName, jobType, appId, cluster, formData } = input;
    const userId = user.identityId;

    const em = await forkEntityManager();
    const existing = await em.findOne(JobTemplate, { userId, templateName, jobType, appId:appId ?? "" });
    if (existing) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `Template with name "${templateName}" already exists`,
      });
    }

    const template = new JobTemplate({ userId, jobType, templateName, appId, cluster, formData });
    await em.persistAndFlush(template);
    return { id: template.id };
  });

export const listTemplates = procedure
  .input(z.object({
    jobType: z.enum(JobType),
    appId: z.string().optional(),
  }))
  .output(z.object({ templates: z.array(TemplateItemSchema) }))
  .query(async ({ input, ctx: { user } }) => {
    const { jobType, appId } = input;
    const userId = user.identityId;

    const em = await forkEntityManager();
    const where: Record<string, unknown> = { userId, jobType };
    if (appId !== undefined) {
      where.appId = appId;
    }

    const templates = await em.find(JobTemplate, where, {
      orderBy: { updatedAt: "DESC" },
    });

    return {
      templates: templates.map((t) => ({
        id: t.id,
        templateName: t.templateName,
        jobType: t.jobType,
        appId: t.appId,
        cluster: t.cluster,
        formData: t.formData,
        createdAt: t.createdAt?.toISOString(),
        updatedAt: t.updatedAt?.toISOString(),
      })),
    };
  });

export const deleteTemplate = procedure
  .input(z.object({ id: z.number() }))
  .output(z.void())
  .mutation(async ({ input, ctx: { user } }) => {
    const em = await forkEntityManager();
    const template = await em.findOne(JobTemplate, { id: input.id });
    if (!template) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
    }
    if (template.userId !== user.identityId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this template" });
    }
    await em.removeAndFlush(template);
  });

export const renameTemplate = procedure
  .input(z.object({
    id: z.number(),
    newName: z.string().min(1).max(100),
  }))
  .output(z.void())
  .mutation(async ({ input, ctx: { user } }) => {
    const { id, newName } = input;
    const userId = user.identityId;

    const em = await forkEntityManager();
    const template = await em.findOne(JobTemplate, { id });
    if (!template) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
    }
    if (template.userId !== userId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this template" });
    }
    const conflict = await em.findOne(JobTemplate, {
      userId, templateName: newName, jobType: template.jobType, appId: template.appId,
    });
    if (conflict) {
      throw new TRPCError({ code: "CONFLICT", message: `Template named "${newName}" already exists` });
    }
    template.templateName = newName;
    await em.persistAndFlush(template);
  });
