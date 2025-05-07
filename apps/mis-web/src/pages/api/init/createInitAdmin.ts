import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { getCurrentLanguageId } from "@scow/lib-web/build/utils/systemLanguage";
import { InitServiceClient } from "@scow/protos/build/server/init";
import { Type } from "@sinclair/typebox";
import { getClient } from "src/utils/client";
import { publicConfig } from "src/utils/config";
import { getUserIdRule } from "src/utils/createUser";
import { queryIfInitialized } from "src/utils/init";
import { route } from "src/utils/route";
import { handlegRPCError } from "src/utils/server";

export const CreateInitAdminSchema = typeboxRouteSchema({
  method: "POST",

  body: Type.Object({
    identityId: Type.String(),
    name: Type.String(),
    email: Type.String(),
    password: Type.String(),
  }),

  responses: {
    200: Type.Object({
      createdInAuth: Type.Boolean(),
    }),
    400: Type.Object({ code: Type.Literal("USER_ID_NOT_VALID") }),

    409: Type.Object({ code: Type.Union([
      Type.Literal("ALREADY_INITIALIZED"),
      Type.Literal("ALREADY_EXISTS_IN_SCOW"),
    ]) }),
  },
});

export default route(CreateInitAdminSchema, async (req) => {
  const result = await queryIfInitialized();

  if (result) { return { 409: { code: "ALREADY_INITIALIZED" as const } }; }

  const { email, identityId, name, password } = req.body;

  const languageId = getCurrentLanguageId(req, publicConfig.SYSTEM_LANGUAGE_CONFIG);

  const userIdRule = getUserIdRule(languageId);

  if (userIdRule && !userIdRule.pattern.test(identityId)) {
    return { 400: {
      code: "USER_ID_NOT_VALID" as const,
      message: userIdRule.message,
    } };
  }

  const client = getClient(InitServiceClient);
  return await asyncClientCall(client, "createInitAdmin", {
    email, name, userId: identityId, password,
  }).then((res) => ({ 200: { createdInAuth: res.createdInAuth } }))
    .catch(handlegRPCError({
      [Status.ALREADY_EXISTS]: () => ({ 409: { code: "ALREADY_EXISTS_IN_SCOW" as const } }),
    }));
});

