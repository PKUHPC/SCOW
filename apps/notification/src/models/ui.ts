import { Static, Type } from "@sinclair/typebox";

export const UiConfigSchema = Type.Object({
  primaryColor: Type.Optional(
    Type.Object({
      defaultColor: Type.String({ description: "默认主题色" }),
      hostnameMap: Type.Optional(
        Type.Record(Type.String(), Type.String(), { description: "根据域名(hostname，不包括port)不同，应用的主题色" }),
      ),
      darkModeColor: Type.Optional(Type.String({ description: "黑暗模式下主题色" })),
    }),
  ),

  defaultPrimaryColor: Type.String({ description: "默认主题色" }),
});

export type UiConfigSchema = Static<typeof UiConfigSchema>;
