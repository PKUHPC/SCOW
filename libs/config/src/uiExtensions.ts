import { Static, Type } from "@sinclair/typebox";

export const UiExtensionConfigSchema = Type.Union([
  Type.Object({ url: Type.String({ description: "扩展的URL" }) }),
  Type.Array(
    Type.Object({
      name: Type.String({ description: "UI扩展名" }),
      url: Type.String({ description: "扩展的URL" }),
    }),
  ),
]);

export type UiExtensionConfigSchema = Static<typeof UiExtensionConfigSchema>;

export const checkUiExtensionConfig = (config: UiExtensionConfigSchema) => {
  if (Array.isArray(config)) {
    // check name duplication
    const exists = new Set<string>();
    for (const { name } of config) {
      if (exists.has(name)) {
        throw new Error(`Multiple UI extensions has the same name: ${name}`);
      }
      exists.add(name);
    }
  }
};
