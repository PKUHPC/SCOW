import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { status } from "@grpc/grpc-js";
import { OperationType } from "@scow/lib-operation-log";
import { getCurrentLanguageId } from "@scow/lib-web/build/utils/systemLanguage";
import { UserServiceClient } from "@scow/protos/build/server/user";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { OperationResult } from "src/models/operationLog";
import { PlatformRole, TenantRole, UserRole } from "src/models/User";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { publicConfig } from "src/utils/config";
import { getUserIdRule, useBuiltinCreateUser } from "src/utils/createUser";
import { route } from "src/utils/route";
import { handlegRPCError, parseIp } from "src/utils/server";

export const CreateUserSchema = typeboxRouteSchema({
  method: "POST",

  body: Type.Object({
    /**
     * 用户ID
     */
    identityId: Type.String(),
    name: Type.String(),
    email: Type.String(),

    /**
     * 密码
     */
    password: Type.String(),
  }),

  responses: {
    200: Type.Object({
      createdInAuth: Type.Boolean(),
    }),

    400: Type.Object({
      code: Type.Union([
        Type.Literal("PASSWORD_NOT_VALID"),
        Type.Literal("USERID_NOT_VALID"),
      ]),
    }),

    /** 用户已经存在 */
    409: Type.Null(),

    /** 本功能在当前配置下不可用 */
    501: Type.Null(),
  },
});

const passwordPattern = publicConfig.PASSWORD_PATTERN && new RegExp(publicConfig.PASSWORD_PATTERN);

export default /* #__PURE__*/route(CreateUserSchema, async (req, res) => {

  if (!useBuiltinCreateUser()) { return { 501: null }; }


  const { email, identityId, name, password } = req.body;

  const auth = authenticate((u) =>
    u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN) ||
    (
      u.accountAffiliations.some((x) => x.role !== UserRole.USER) &&
      publicConfig.ADD_USER_TO_ACCOUNT.accountAdmin.createUserIfNotExist
    ) ||
    u.tenantRoles.includes(TenantRole.TENANT_ADMIN),
  );

  const info = await auth(req, res);

  if (!info) { return; }

  const languageId = getCurrentLanguageId(req, publicConfig.SYSTEM_LANGUAGE_CONFIG);

  const userIdRule = getUserIdRule(languageId);


  if (userIdRule && !userIdRule.pattern.test(identityId)) {
    return { 400: { code: "USERID_NOT_VALID" as const } };
  }

  if (passwordPattern && !passwordPattern.test(password)) {
    return { 400: { code: "PASSWORD_NOT_VALID" as const } };
  }

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.createUser,
    operationTypePayload:{
      userId: identityId,
    },
  };

  // create user on server
  const client = getClient(UserServiceClient);

  return await asyncClientCall(client, "createUser", {
    identityId,
    email: email,
    name: name,
    password,
    tenantName: info.tenant,
  })
    .then(async (res) => {
      await callLog(logInfo, OperationResult.SUCCESS);
      return { 200: { createdInAuth: res.createdInAuth } };
    })
    .catch(handlegRPCError({
      [status.ALREADY_EXISTS]: () => ({ 409: null }),
    },
    async () => await callLog(logInfo, OperationResult.FAIL),
    ));
});
