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

export const RenameAppTemplateSchema = typeboxRouteSchema({
  method: "POST",

  body: Type.Object({
    id: Type.Number(),
    newName: Type.String(),
    templateName: Type.String(),
  }),

  responses: {
    204: Type.Null(),
    404: Type.Object({ code: Type.Literal("TEMPLATE_NOT_FOUND") }),
    409: Type.Object({ code: Type.Literal("ALREADY_EXISTS") }),
    403: Type.Object({ code: Type.Literal("PERMISSION_DENIED") }),
  },
});

const auth = authenticate(() => true);

export default /* #__PURE__*/ route(RenameAppTemplateSchema, async (req, res) => {
  const info = await auth(req, res);

  if (!info) {
    return;
  }

  const { id, newName, templateName } = req.body;

  const client = getMisClient(AppTemplateServiceClient);

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.updateJobTemplate,
    operationTypePayload: {
      jobTemplateId: templateName,
      newJobTemplateId: newName,
    },
  };

  return asyncUnaryCall(client, "renameAppTemplate", {
    userId: info.identityId,
    id,
    newName,
  }).then(
    async () => {
      await callLog({ ...logInfo }, OperationResult.SUCCESS);
      return { 204: null };
    },
    handlegRPCError(
      {
        [status.NOT_FOUND]: () => ({ 404: { code: "TEMPLATE_NOT_FOUND" } }) as const,
        [status.ALREADY_EXISTS]: () => ({ 409: { code: "ALREADY_EXISTS" } }) as const,
        [status.PERMISSION_DENIED]: () => ({ 403: { code: "PERMISSION_DENIED" } }) as const,
      },
      async () => await callLog({ ...logInfo }, OperationResult.FAIL),
    ),
  );
});
