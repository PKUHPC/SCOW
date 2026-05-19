import { z } from "zod";

export const extensionEvents = z.discriminatedUnion("type", [
  z.object({ type: z.literal("scow.extensionPageHeightChanged"), payload: z.object({ height: z.number() }) }),
  z.object({ type: z.literal("scow.extensionPageTitleChanged"), payload: z.object({ title: z.string() }) }),
  z.object({ type: z.literal("scow.reloadNavbarLink"), payload: z.object({}) }),
  z.object({ type: z.literal("scow.reloadNavigations"), payload: z.object({}) }),
  z.object({ type: z.literal("scow.logout"), payload: z.object({}) }),
]);
