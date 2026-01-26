import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { status } from "@grpc/grpc-js";
import { AppServiceClient, getAppMetadataResponse_ReservedAppAttributeNameToJSON } from "@scow/protos/build/portal/app";
import { camelToSnakeCase } from "@scow/utils";
import { Static, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { authenticate } from "src/auth/server";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";
import { handlegRPCError } from "src/utils/server";

export const I18nStringSchemaType = Type.Union([
  Type.String(),
  Type.Object({
    i18n: Type.Object({
      default: Type.String(),
      en: Type.Optional(Type.String()),
      zh_cn: Type.Optional(Type.String()),
    }),
  }),
]);
export type I18nStringSchemaType = Static<typeof I18nStringSchemaType>;

export const SelectOption = Type.Object({
  value: Type.String(),
  label: I18nStringSchemaType,
});
export type SelectOption = Static<typeof SelectOption>;

const OptionsSchema = Type.Array(SelectOption);

function validateOptions(options: any): SelectOption[] {
  if (Value.Check(OptionsSchema, options)) {
    return options;
  }
  const errors = Array.from(Value.Errors(OptionsSchema, options));
  const errorMessage = errors.map((e) => `${e.path}: ${e.message}`).join("; ");
  throw new Error(`Invalid options format: ${errorMessage}`);
}

export const GetDynamicFormOptionsSchema = typeboxRouteSchema({
  method: "GET",
  query: Type.Object({
    cluster: Type.String(),
    appId: Type.String(),
    attributeName: Type.String(),
  }),
  responses: {
    200: Type.Object({
      options: Type.Array(SelectOption),
    }),
    404: Type.Object({ code: Type.Literal("NOT_FOUND") }),
    500: Type.Object({
      code: Type.Literal("INTERNAL_ERROR"),
      error: Type.String(),
    }),
  },
});

const auth = authenticate(() => true);

export default /* #__PURE__*/route(GetDynamicFormOptionsSchema, async (req, res) => {
  const { cluster, appId, attributeName } = req.query;

  const authInfo = await auth(req, res);

  if (!authInfo) {
    return;
  }

  const client = getClient(AppServiceClient);

  // 1. Get App Metadata to find script
  const appMetadata = await asyncUnaryCall(client, "getAppMetadata", {
    appId, cluster,
  });

  let script: string | undefined;

  const reservedAttr = appMetadata.reservedAppAttributes.find((attr) =>
    camelToSnakeCase(attributeName) === getAppMetadataResponse_ReservedAppAttributeNameToJSON(attr.name),
  );

  if (reservedAttr && reservedAttr.config?.$case === "commandSelectConfig") {
    script = reservedAttr.config.commandSelectConfig.script;
  }

  if (!script) {
    const attr = appMetadata.attributes.find((a) => a.name === attributeName);
    if (attr?.commandSelect?.script) {
      script = attr.commandSelect.script;
    }
  }

  if (!script) {
    return { 500: { code: "INTERNAL_ERROR" as const, error: `Script not found for attribute ${attributeName}` } };
  }

  // 2. Run Script
  return asyncUnaryCall(client, "runScript", {
    cluster, script, userId: authInfo.identityId, timeoutSeconds: 20,
  }).then(({ output }) => {
    let options: SelectOption[] = [];
    try {
      if (output) {
        const parsed = JSON.parse(output);
        options = validateOptions(parsed);
      }
    } catch (e) {
      console.error("Failed to parse or validate dynamic form options", e);
      return { 500: { code: "INTERNAL_ERROR" as const, error: "Failed to parse dynamic form options" } };
    }

    return {
      200: {
        options: options.map((opt) => ({
          label: opt.label,
          value: opt.value,
        })),
      },
    };
  }, handlegRPCError({
    [status.NOT_FOUND]: () => ({ 404: { code: "NOT_FOUND" } } as const),
    [status.INTERNAL]: (e) => ({ 500: { code: "INTERNAL_ERROR", error: e.details } } as const),
  }));
});
