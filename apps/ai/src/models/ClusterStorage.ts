import z from "zod";

export const I18nStringTypeSchema = z.union([
  z.string(),
  z.object({
    i18n: z.object({
      default: z.string(),
      en: z.string().optional(),
      zh_cn: z.string().optional(),
      ja: z.string().optional(),
      ko: z.string().optional(),
      fr: z.string().optional(),
      de: z.string().optional(),
      es: z.string().optional(),
      pt: z.string().optional(),
      ru: z.string().optional(),
    }),
  }),
]);

const PathEntrySchema = z.object({
  displayName: I18nStringTypeSchema,
  // resolvedPath: z.string(),
  pathTemplate: z.string(),
});

export const ClusterEntryPathSchema = z.object({
  storageId: z.string(),
  mountPath: z.string(),
  paths: z.array(PathEntrySchema).optional(),
});
export type ClusterEntryPath = z.infer<typeof ClusterEntryPathSchema>;

export const PublicStorageItem = z.object({
  storageId: z.string(),
  displayName: I18nStringTypeSchema.optional(),
  quotaEnabled: z.boolean(),
  replicaExist: z.boolean(),
});
export const PublicStorageConfigSchema = z.object({
  storages: z.array(PublicStorageItem),
});

export type PublicStorageConfig = z.infer<typeof PublicStorageConfigSchema>;
