import { z } from "zod";
import { isHttpUrl, isSafeExtensionPath } from "src/features/uiExtension/paths";
import type { UiExtensionNavigationItem } from "src/features/uiExtension/types";

const extensionUrlSchema = z.string().refine(isHttpUrl, "UI extension URL must use HTTP or HTTPS");
const extensionPathSchema = z
  .string()
  .refine(isSafeExtensionPath, "UI extension path must be relative or use HTTP or HTTPS");

export const uiExtensionConfigSchema = z.union([
  z.object({ url: extensionUrlSchema }),
  z.array(z.object({ name: z.string(), url: extensionUrlSchema })),
]);

const sourceManifestSchema = z.object({
  rewriteNavigations: z.boolean().default(false),
  navbarLinks: z
    .union([
      z.boolean(),
      z.object({
        enabled: z.boolean().default(false),
        autoRefresh: z
          .object({
            enabled: z.boolean().default(false),
            intervalMs: z.number(),
          })
          .optional(),
      }),
    ])
    .default(false),
});

export const uiExtensionManifestSchema = z.object({
  portal: sourceManifestSchema.optional(),
  mis: sourceManifestSchema.optional(),
  ai: sourceManifestSchema.optional(),
});

export const navbarLinkSchema = z.object({
  path: extensionPathSchema,
  text: z.string(),
  icon: z.object({ src: z.string(), alt: z.string().optional() }).optional(),
  openInNewPage: z.boolean().default(true),
  priority: z.number().default(0),
  autoRefresh: z.object({ intervalMs: z.number() }).optional(),
});

export const navbarLinksResponseSchema = z.object({
  navbarLinks: z.array(navbarLinkSchema).optional(),
});

export const navigationItemSchema: z.ZodType<UiExtensionNavigationItem> = z.lazy(() =>
  z.object({
    path: extensionPathSchema,
    clickToPath: extensionPathSchema.optional(),
    text: z.string(),
    icon: z.object({ src: z.string(), alt: z.string().optional() }).optional(),
    svgIcon: z.string().optional(),
    openInNewPage: z.boolean().optional(),
    hideIfNotActive: z.boolean().optional(),
    children: z.array(navigationItemSchema).optional(),
  }),
);

export const rewriteNavigationsResponseSchema = z.object({
  navs: z.array(navigationItemSchema),
});

export const extensionEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("scow.extensionPageHeightChanged"), payload: z.object({ height: z.number() }) }),
  z.object({ type: z.literal("scow.extensionPageTitleChanged"), payload: z.object({ title: z.string() }) }),
  z.object({ type: z.literal("scow.reloadNavbarLink"), payload: z.object({}) }),
  z.object({ type: z.literal("scow.reloadNavigations"), payload: z.object({}) }),
  z.object({ type: z.literal("scow.logout"), payload: z.object({}) }),
]);

export const portalExtensionConfigResponseSchema = z.object({
  uiExtension: uiExtensionConfigSchema.optional(),
});

export const aiExtensionConfigResponseSchema = z.object({
  UI_EXTENSION: uiExtensionConfigSchema.optional(),
});
