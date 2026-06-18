import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { status } from "@grpc/grpc-js";
import { OperationType } from "@scow/lib-operation-log";
import { AppTemplateServiceClient } from "@scow/protos/build/server/app_template";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { OperationResult } from "src/models/operationLog";
import { callLog } from "src/server/operationLog";
import { getMisClient } from "src/utils/misClient";
import { route } from "src/utils/route";
import { handlegRPCError, parseIp } from "src/utils/server";

export const DeleteAppTemplateSchema = typeboxRouteSchema({
  method: "DELETE",

  query: Type.Object({
    id: Type.Number(),
    templateName: Type.String(),
  }),

  responses: {
    204: Type.Null(),
    404: Type.Object({ code: Type.Literal("TEMPLATE_NOT_FOUND") }),
    403: Type.Object({ code: Type.Literal("PERMISSION_DENIED") }),
  },
});

const auth = authenticate(() => true);

export default /* #__PURE__*/ route(DeleteAppTemplateSchema, async (req, res) => {
  const info = await auth(req, res);

  if (!info) {
    return;
  }

  const { id, templateName } = req.query;

  const client = getMisClient(AppTemplateServiceClient);

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.deleteJobTemplate,
    operationTypePayload: {
      jobTemplateId: templateName,
    },
  };

  return asyncUnaryCall(client, "deleteAppTemplate", {
    userId: info.identityId,
    id,
  }).then(
    async () => {
      await callLog({ ...logInfo }, OperationResult.SUCCESS);
      return { 204: null };
    },
    handlegRPCError(
      {
        [status.NOT_FOUND]: () => ({ 404: { code: "TEMPLATE_NOT_FOUND" } }) as const,
        [status.PERMISSION_DENIED]: () => ({ 403: { code: "PERMISSION_DENIED" } }) as const,
      },
      async () => await callLog({ ...logInfo }, OperationResult.FAIL),
    ),
  );
});
