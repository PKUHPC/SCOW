import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { status } from "@grpc/grpc-js";
import { createI18nStringSchema } from "@scow/config/build/i18n";
import { getI18nTypeFormat } from "@scow/lib-web/build/utils/typeConversion";
import {
  appCustomAttribute_AttributeTypeToJSON,
  AppServiceClient,
  FileInputConfig,
  FileInputConfig_SelectionType,
  FixedValue as FixedValueProto,
  getAppMetadataResponse_ReservedAppAttributeNameToJSON,
} from "@scow/protos/build/portal/app";
import { areFileExtensionsValid } from "@scow/utils";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { ReservedAppAttributeName } from "src/models/job";
import { getClient } from "src/utils/client";
import { extractOneOfValue } from "src/utils/convertValue";
import { route } from "src/utils/route";
import { handlegRPCError } from "src/utils/server";

export const I18nStringSchemaType = createI18nStringSchema({
  description: "I18nStringSchemaType",
});

export type I18nStringSchemaType = Static<typeof I18nStringSchemaType>;

export const SelectOption = Type.Object({
  value: Type.String(),
  label: I18nStringSchemaType,
  requireGpu: Type.Optional(Type.Boolean()),
});
export type SelectOption = Static<typeof SelectOption>;

export const FixedValue = Type.Object({
  value: Type.Union([Type.String(), Type.Number()]),
  hidden: Type.Optional(Type.Boolean()),
});
export type FixedValue = Static<typeof FixedValue>;

export const CommandSelectConfig = Type.Object({
  script: Type.String(),
});
export type CommandSelectConfig = Static<typeof CommandSelectConfig>;

export const FileInputConfigSchema = Type.Object({
  selectionType: Type.Union([Type.Literal("FILE"), Type.Literal("DIRECTORY")]),
  extensions: Type.Optional(Type.Array(Type.String())),
});
export type FileInputConfigSchema = Static<typeof FileInputConfigSchema>;

// Cannot use AppCustomAttribute from protos
export const AppCustomAttribute = Type.Object({
  type: Type.Union([
    Type.Literal("NUMBER"),
    Type.Literal("SELECT"),
    Type.Literal("TEXT"),
    Type.Literal("FILE"),
    Type.Literal("COMMAND_SELECT"),
    Type.Literal("PASSWORD"),
  ]),
  label: I18nStringSchemaType,
  name: Type.String(),
  fixedValue: Type.Optional(FixedValue),
  required: Type.Boolean(),
  placeholder: Type.Optional(I18nStringSchemaType),
  defaultValue: Type.Optional(
    Type.Union([
      Type.String(),
      Type.Number(),
      // Type.Undefined(),
    ]),
  ),
  select: Type.Array(SelectOption),
  commandSelect: Type.Optional(CommandSelectConfig),
  file: Type.Optional(FileInputConfigSchema),
});
export type AppCustomAttribute = Static<typeof AppCustomAttribute>;

export const SelectConfigOption = Type.Object({
  value: Type.Union([Type.String(), Type.Number()]),
  label: Type.Optional(I18nStringSchemaType),
  requireGpu: Type.Optional(Type.Boolean()),
});
export type SelectConfigOption = Static<typeof SelectConfigOption>;

export const SelectConfig = Type.Object({
  type: Type.Literal("select"),
  defaultValue: Type.Optional(Type.Union([Type.String(), Type.Number()])),
  select: Type.Array(SelectConfigOption),
});
export type SelectConfig = Static<typeof SelectConfig>;

export const FixedValueConfig = Type.Object({
  type: Type.Literal("fixedValue"),
  fixedValue: FixedValue,
});
export type FixedValueConfig = Static<typeof FixedValueConfig>;

export const CommandSelectReservedConfig = Type.Object({
  type: Type.Literal("commandSelect"),
});

export type CommandSelectReservedConfig = Static<typeof CommandSelectReservedConfig>;

export const ReservedConfig = Type.Union([FixedValueConfig, SelectConfig, CommandSelectReservedConfig]);
export type ReservedConfig = Static<typeof ReservedConfig>;

export const ReservedAppAttribute = Type.Object({
  name: Type.Enum(ReservedAppAttributeName),
  reservedConfig: ReservedConfig,
});
export type ReservedAppAttribute = Static<typeof ReservedAppAttribute>;

export const GetAppMetadataSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    cluster: Type.String(),
    appId: Type.String(),
  }),

  responses: {
    200: Type.Object({
      appName: Type.String(),
      appCustomFormAttributes: Type.Array(AppCustomAttribute),
      appComment: Type.Optional(I18nStringSchemaType),
      reservedAppAttributes: Type.Array(ReservedAppAttribute),
      ignoreGpu: Type.Boolean(),
    }),

    // appId not exists
    404: Type.Object({ code: Type.Literal("APP_NOT_FOUND") }),

    500: Type.Object({
      code: Type.Literal("APP_CONFIG_ERROR"),
      error: Type.String(),
    }),
  },
});

const auth = authenticate(() => true);

class InvalidFileInputConfigError extends Error {}

function convertFileInputConfig(file: FileInputConfig | undefined): FileInputConfigSchema | undefined {
  if (!file) {
    return undefined;
  }
  if (!areFileExtensionsValid(file.extensions)) {
    throw new InvalidFileInputConfigError("Invalid file extension configuration");
  }

  switch (file.selectionType) {
    case FileInputConfig_SelectionType.FILE:
      return {
        selectionType: "FILE",
        extensions: file.extensions.length > 0 ? file.extensions : undefined,
      };
    case FileInputConfig_SelectionType.DIRECTORY:
      if (file.extensions.length > 0) {
        throw new InvalidFileInputConfigError("Directory file input cannot configure extensions");
      }
      return { selectionType: "DIRECTORY" };
    case FileInputConfig_SelectionType.SELECTION_TYPE_UNSPECIFIED:
    default:
      throw new InvalidFileInputConfigError("Unknown file selection type");
  }
}

export default /* #__PURE__*/ route(GetAppMetadataSchema, async (req, res) => {
  const info = await auth(req, res);

  if (!info) {
    return;
  }

  const { appId, cluster } = req.query;

  const client = getClient(AppServiceClient);

  return asyncUnaryCall(client, "getAppMetadata", { appId, cluster }).then(
    (reply) => {
      let attributes: AppCustomAttribute[];
      try {
        attributes = reply.attributes.map((item) => ({
          type: appCustomAttribute_AttributeTypeToJSON(item.type) as AppCustomAttribute["type"],
          label: getI18nTypeFormat(item.label),
          name: item.name,
          fixedValue:
            item.fixedValue?.value !== undefined
              ? {
                  value:
                    item.fixedValue.value?.$case === "text" ? item.fixedValue.value.text : item.fixedValue.value.number,
                  hidden: item.fixedValue?.hidden,
                }
              : undefined,
          select: item.options?.map((option) => {
            return {
              value: option.value,
              label: getI18nTypeFormat(option.label),
              requireGpu: option.requireGpu,
            };
          }),
          required: item.required,
          defaultValue: item.defaultInput
            ? item.defaultInput?.$case === "text"
              ? item.defaultInput.text
              : item.defaultInput.number
            : undefined,
          placeholder: getI18nTypeFormat(item.placeholder),
          file: convertFileInputConfig(item.file),
        }));
      } catch (error) {
        if (!(error instanceof InvalidFileInputConfigError)) {
          throw error;
        }

        return {
          500: {
            code: "APP_CONFIG_ERROR" as const,
            error: "Invalid application file input configuration",
          },
        };
      }

      const getFixedValueResp = (fixedValueProto: FixedValueProto): FixedValue => {
        if (!fixedValueProto?.value) {
          // 返回默认值而不是 undefined
          return { value: "" };
        }
        return {
          value: fixedValueProto.value.$case === "text" ? fixedValueProto.value.text : fixedValueProto.value.number,
          hidden: fixedValueProto.hidden,
        };
      };

      const reservedAppAttributes: ReservedAppAttribute[] = reply.reservedAppAttributes.map((item) => {
        const attribute = {
          name: getAppMetadataResponse_ReservedAppAttributeNameToJSON(item.name) as ReservedAppAttributeName,
        } as ReservedAppAttribute;

        if (item.config?.$case === "fixedValueConfig" && item.config.fixedValueConfig.fixedValue) {
          attribute.reservedConfig = {
            type: "fixedValue",
            fixedValue: getFixedValueResp(item.config.fixedValueConfig.fixedValue),
          };
        } else if (item.config?.$case === "selectConfig") {
          attribute.reservedConfig = {
            type: "select",
            defaultValue: item.config?.selectConfig.defaultInput
              ? extractOneOfValue(item.config?.selectConfig.defaultInput)
              : undefined,
            select:
              item.config?.selectConfig.options?.map((option) => {
                return {
                  value: option.value !== undefined ? extractOneOfValue(option.value) : "",
                  label: getI18nTypeFormat(option.label),
                  requireGpu: option.requireGpu,
                };
              }) || [],
          };
        } else if (item.config?.$case === "commandSelectConfig") {
          attribute.reservedConfig = {
            type: "commandSelect",
          };
        }
        return attribute;
      });

      const comment = getI18nTypeFormat(reply.appComment);

      return {
        200: {
          appName: reply.appName,
          appCustomFormAttributes: attributes,
          appComment: comment,
          reservedAppAttributes,
          ignoreGpu: reply.ignoreGpu,
        },
      };
    },
    handlegRPCError({
      [status.NOT_FOUND]: () => ({ 404: { code: "APP_NOT_FOUND" } }) as const,
      [status.UNKNOWN]: (e) => ({ 500: { code: "APP_CONFIG_ERROR" as const, error: e.details } }),
    }),
  );
});
