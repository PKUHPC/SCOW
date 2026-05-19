import { GetConfigFn, getConfigFromFile } from "@scow/lib-config";
import { Static, Type } from "@sinclair/typebox";
import { DEFAULT_CONFIG_BASE_PATH } from "src/constants";
import { createI18nStringSchema } from "src/i18n";

export const ClusterTextsConfigSchema = Type.Record(
  Type.String({ description: "租户，如果为default则是对所有租户" }),
  Type.Object(
    {
      clusterComment: Type.Optional(createI18nStringSchema({ description: "集群说明" })),
      extras: Type.Optional(
        Type.Array(
          Type.Object({
            title: createI18nStringSchema({ description: "标题" }),
            content: createI18nStringSchema({ description: "内容" }),
          }),
        ),
      ),
    },
    { description: "其他内容" },
  ),
);

const CLUSTER_TEXTS_CONFIG_SCHEMA = "clusterTexts";

export type ClusterTextsConfigSchema = Static<typeof ClusterTextsConfigSchema>;

export const getClusterTextsConfig: GetConfigFn<ClusterTextsConfigSchema> = (baseConfigPath) =>
  getConfigFromFile(ClusterTextsConfigSchema, CLUSTER_TEXTS_CONFIG_SCHEMA, baseConfigPath ?? DEFAULT_CONFIG_BASE_PATH);
