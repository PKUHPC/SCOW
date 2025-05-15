import { typeboxRoute, typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { unlockUser } from "@scow/lib-auth";
import { getCapabilities } from "@scow/lib-auth";
import { OperationType } from "@scow/lib-operation-log";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { OperationResult } from "src/models/operationLog";
import { PlatformRole } from "src/models/User";
import { callLog } from "src/server/operationLog";
import { runtimeConfig } from "src/utils/config";
import { parseIp } from "src/utils/server";

export const UnlockUserSchema = typeboxRouteSchema({

  method: "PATCH",

  body: Type.Object({
    identityId: Type.String(),
  }),

  responses: {
    /** 解锁成功 */
    204: Type.Null(),

    /** 用户未找到 */
    404: Type.Null(),

    /** 解锁失败 */
    500: Type.Null(),

    /** 本功能在当前配置下不可用。 */
    501: Type.Null(),
  },
});


export default /* #__PURE__*/typeboxRoute(
  UnlockUserSchema, async (req, res) => {

    const auth = authenticate((info) => info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN));

    const info = await auth(req, res);

    if (!info) { return; }

    const ldapCapabilities = await getCapabilities(runtimeConfig.AUTH_INTERNAL_URL);
    if (!ldapCapabilities.lockUser) {
      return { 501: null };
    }

    const { identityId } = req.body;

    const logInfo = {
      operatorUserId: info.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.unlockUser,
      operationTypePayload:{
        identityId: identityId,
      },
    };

    return await unlockUser(runtimeConfig.AUTH_INTERNAL_URL, { identityId }, console)
      .then(async () => {
        await callLog(logInfo, OperationResult.SUCCESS);
        return { 204: null };
      })
      .catch(async (e) => {
        await callLog(logInfo, OperationResult.FAIL);
        return { [e.status]: null };
      });

  });
