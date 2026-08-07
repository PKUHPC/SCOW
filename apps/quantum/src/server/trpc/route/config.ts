import { getCommonConfig, getSystemLanguageConfig } from "@scow/config/build/common";
import { DEFAULT_PRIMARY_COLOR } from "@scow/config/build/ui";
import { getCapabilities } from "@scow/lib-auth";
import { getHostname } from "@scow/lib-web/build/utils/getHostname";
import { readVersionFile } from "@scow/utils/build/version";
import { commonConfig } from "src/server/config/common";
import { config } from "src/server/config/env";
import { quantumConfig } from "src/server/config/quantum";
import { uiConfig } from "src/server/config/ui";
import { router, trpc } from "src/server/trpc/def";
import { z } from "zod";

export const PartitionSchema = z.object({
  name: z.string(),
  memMb: z.number(),
  cores: z.number(),
  gpus: z.number(),
  nodes: z.number(),
  qos: z.array(z.string()),
  comment: z.string().optional(),
  gpuType: z.string().optional(),
  vramMb: z.number().optional(),
});

export const configRouter = router({
  publicConfig: trpc.procedure.input(z.void()).query(async ({ ctx: { req } }) => {
    const systemLanguageConfig = getSystemLanguageConfig(getCommonConfig().systemLanguage);

    const darkModeCookie = req.cookies["scow-dark"];
    const languageCookie = req.cookies.language;

    const hostname = getHostname(req);

    const footerText =
      (hostname && uiConfig.footer?.hostnameMap?.[hostname]) ??
      (hostname && uiConfig.footer?.hostnameTextMap?.[hostname]) ??
      uiConfig.footer?.defaultText;

    const capabilities =
      process.env.NODE_ENV === "development"
        ? { changePassword: false }
        : await getCapabilities(config.AUTH_INTERNAL_URL);

    return {
      ENABLE_CHANGE_PASSWORD: capabilities.changePassword ?? false,
      PASSWORD_PATTERN: commonConfig.passwordPattern?.regex,

      uiConfig: {
        config: uiConfig,
        defaultPrimaryColor: DEFAULT_PRIMARY_COLOR,
      },
      systemLanguageConfig: systemLanguageConfig,
      basePath: config.NEXT_PUBLIC_RUNTIME_BASE_PATH,
      portalUrl: config.PORTAL_URL,
      misUrl: config.MIS_URL,
      auditDeployed: config.AUDIT_DEPLOYED,
      aiUrl: config.AI_DEPLOYED ? config.AI_URL : "",
      versionTag: readVersionFile()?.tag,

      footerText,

      acceptLanguageHeader: req.headers["accept-language"] || null,
      darkModeCookie: darkModeCookie,
      languageCookie: languageCookie,
    };
  }),

  getOffsetDegree: trpc.procedure
    .input(
      z.object({
        chipId: z.string(),
      }),
    )
    .output(
      z.object({
        offsetDegree: z.number(),
      }),
    )
    .query(async ({ input }) => {
      const { chipId } = input;
      const offsetDegree = quantumConfig.offsetDegree?.[chipId] ?? 0;

      return { offsetDegree };
    }),
});
