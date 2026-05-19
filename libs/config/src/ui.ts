import { GetConfigFn, getConfigFromFile } from "@scow/lib-config";
import { Static, Type } from "@sinclair/typebox";
import { DEFAULT_CONFIG_BASE_PATH } from "src/constants";

export const DEFAULT_PRIMARY_COLOR = "#B60003";

export const UiConfigSchema = Type.Object({
  footer: Type.Optional(
    Type.Object({
      defaultText: Type.Optional(Type.String({ description: "默认的footer文本" })),
      hostnameMap: Type.Optional(
        Type.Record(Type.String(), Type.String(), {
          description: "根据域名(hostname，不包括port)不同，显示在footer上的文本",
        }),
      ),
      hostnameTextMap: Type.Optional(
        Type.Record(Type.String(), Type.String(), {
          description: "根据域名(hostname，不包括port)不同，显示在footer上的文本",
          deprecated: true,
        }),
      ),
    }),
  ),

  primaryColor: Type.Optional(
    Type.Object({
      defaultColor: Type.String({ description: "默认主题色", default: DEFAULT_PRIMARY_COLOR }),
      hostnameMap: Type.Optional(
        Type.Record(Type.String(), Type.String(), { description: "根据域名(hostname，不包括port)不同，应用的主题色" }),
      ),
      darkModeColor: Type.Optional(Type.String({ description: "黑暗模式下主题色" })),
    }),
  ),

  titleTag: Type.Optional(Type.String({ description: "网页标题后缀标签" })),
});

const UI_CONFIG_NAME = "ui";

export interface PrimaryColor {
  defaultColor: string;
  darkModeColor?: string;
}

export type UiConfigSchema = Static<typeof UiConfigSchema>;

export const getUiConfig: GetConfigFn<UiConfigSchema> = (baseConfigPath) => {
  return getConfigFromFile(UiConfigSchema, UI_CONFIG_NAME, baseConfigPath ?? DEFAULT_CONFIG_BASE_PATH);
};
