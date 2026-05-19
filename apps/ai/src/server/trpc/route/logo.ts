import { DEFAULT_CONFIG_BASE_PATH } from "@scow/config/build/constants";
import { getUiConfig } from "@scow/config/build/ui";
import { serveIcon } from "@scow/lib-web/build/routes/icon/icon";
import { serveLogo } from "@scow/lib-web/build/routes/icon/logo";
import { router } from "src/server/trpc/def";
import { baseProcedure } from "src/server/trpc/procedure/base";
import { z } from "zod";

export const logo = router({
  logo: baseProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/logo",
        tags: ["logo"],
        summary: "logo",
      },
    })
    .input(
      z.object({
        type: z.enum(["logo", "banner"]),
        preferDark: z.enum(["true", "false"]).default("false"),
      }),
    )
    .output(z.void())
    .query(async ({ ctx: { req, res } }) => {
      const primaryColor = getUiConfig().primaryColor?.defaultColor;
      return serveLogo(req, res, "assets/logo", DEFAULT_CONFIG_BASE_PATH, primaryColor);
    }),

  icon: baseProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/icon",
        tags: ["logo"],
        summary: "icon",
      },
    })
    .input(
      z.object({
        type: z.enum(["favicon", "512", "192"]),
      }),
    )
    .output(z.void())
    .query(async ({ ctx: { req, res } }) => {
      return serveIcon(req, res, "assets/icons", DEFAULT_CONFIG_BASE_PATH);
    }),
});
