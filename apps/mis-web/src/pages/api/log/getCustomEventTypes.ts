import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { createOperationLogClient } from "@scow/lib-operation-log/build/index";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { runtimeConfig } from "src/utils/config";
import { route } from "src/utils/route";

export const I18nObjectSchema = Type.Optional(Type.Object({
  i18n: Type.Optional(Type.Object({
    default: Type.String(),
    en: Type.Optional(Type.String()),
    zhCn: Type.Optional(Type.String()),
  })),
}));

export type I18nObjectSchemaType = Static<typeof I18nObjectSchema>;

export const CustomEventTypeSchema = Type.Object({
  type: Type.String(),
  name: I18nObjectSchema,
});

export const GetCustomEventTypesSchema = typeboxRouteSchema({

  method: "GET",

  responses: {
    200: Type.Object({
      results: Type.Array(CustomEventTypeSchema),
    }),


    403: Type.Null(),
  },
});

export default route(GetCustomEventTypesSchema, async (req, res) => {
  const auth = authenticate(() => true);

  const info = await auth(req, res);

  if (!info) { return; }

  const { getCustomEventTypes } = createOperationLogClient(runtimeConfig.AUDIT_CONFIG, console);
  const resp = await getCustomEventTypes();

  const { customEventTypes } = resp;

  return {
    200: { results: customEventTypes },
  };
});
