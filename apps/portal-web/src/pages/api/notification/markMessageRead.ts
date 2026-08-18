import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { getNotificationNodeClient } from "@scow/lib-notification/build/client";
import { OperationType } from "@scow/lib-operation-log";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { OperationResult } from "src/models/operationLog";
import { callLog } from "src/server/operationLog";
import { publicConfig } from "src/utils/config";
import { route } from "src/utils/route";
import { parseIp } from "src/utils/server";

export const MarkMessageReadSchema = typeboxRouteSchema({
  method: "POST",

  body: Type.Object({
    messageId: Type.Number(),
  }),

  responses: {
    204: Type.Null(),
    500: Type.Object({ code: Type.Literal("MARK_MESSAGE_READ_ERROR") }),
    503: Type.Object({ code: Type.Literal("SERVICE_TEMPORARILY_UNAVAILABLE") }),
  },
});

const auth = authenticate(() => true);

export default /* #__PURE__*/ route(MarkMessageReadSchema, async (req, res) => {
  const info = await auth(req, res);

  if (!info) {
    return;
  }

  const { messageId } = req.body;

  const notifClient = getNotificationNodeClient(publicConfig.NOTIF_ADDRESS);

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.markMessageRead,
    operationTypePayload: { messageId: messageId },
  };

  return notifClient.scowMessage
    .markMessageRead({ userId: info.identityId, messageId: BigInt(messageId) })
    .then(async () => {
      await callLog(logInfo, OperationResult.SUCCESS);
      return { 204: null };
    })
    .catch((e) => {
      console.error("Error marking message read", { userId: info.identityId, messageId }, e);
      return { 500: { code: "MARK_MESSAGE_READ_ERROR" as const } };
    });
});
