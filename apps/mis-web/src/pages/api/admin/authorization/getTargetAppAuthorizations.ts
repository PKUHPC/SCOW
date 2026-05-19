import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { status } from "@grpc/grpc-js";
import { AppAuthorizationServiceClient } from "@scow/protos/build/server/app_authorization";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { AppAuthTargetType, AppAuthTargetTypeProto } from "src/models/app";
import { PlatformRole, TenantRole } from "src/models/User";
import { getClient } from "src/utils/client";
import { safeGetStringProperty } from "src/utils/format";
import { route } from "src/utils/route";
import { handlegRPCError } from "src/utils/server";

export const AppAuthorizationInfo = Type.Object({
  appId: Type.String(),
  appName: Type.String(),
  isDisabled: Type.Boolean(),
});
export type AppAuthorizationInfo = Static<typeof AppAuthorizationInfo>;

export const TargetAppList = Type.Object({
  targetName: Type.String(),
  appsInfo: Type.Array(AppAuthorizationInfo),
  availableAppsCount: Type.Number(),
  accountOwnerId: Type.Optional(Type.String()),
  accountOwnerName: Type.Optional(Type.String()),
});
export type TargetAppList = Static<typeof TargetAppList>;

export const GetTargetAppAuthorizationsSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    /**
     * @minimum 1
     * @type integer
     */
    page: Type.Integer({ minimum: 1 }),

    /**
     * @type integer
     */
    pageSize: Type.Integer(),

    clusterId: Type.String(),

    // 查询类型，租户或账户
    targetType: Type.Enum(AppAuthTargetType),

    // 按名称搜索时的搜索参数
    filterTargetName: Type.Optional(Type.String()),

    // 当搜索类型为账户时搜索的拥有者ID或姓名
    filterAccountOwnerIdOrName: Type.Optional(Type.String()),
  }),

  responses: {
    200: Type.Object({
      appLists: Type.Array(TargetAppList),
      totalCount: Type.Number(),
    }),
    400: Type.Object({
      code: Type.Literal("INVALID_ARGUMENT"),
      message: Type.Optional(Type.String()),
    }),
    409: Type.Object({
      code: Type.Literal("FAILED_PRECONDITION"),
      message: Type.Optional(Type.String()),
    }),
  },
});

const formatTargetTypeProto = (targetType: AppAuthTargetType): AppAuthTargetTypeProto => {
  switch (targetType) {
    case AppAuthTargetType.TENANT:
      return AppAuthTargetTypeProto.TENANT;
    case AppAuthTargetType.ACCOUNT:
      return AppAuthTargetTypeProto.ACCOUNT;
    default:
      return AppAuthTargetTypeProto.UNKNOWN;
  }
};

export default route(GetTargetAppAuthorizationsSchema, async (req, res) => {
  const { page, pageSize, clusterId, targetType, filterTargetName, filterAccountOwnerIdOrName } = req.query;

  const auth = authenticate((info) => {
    return targetType === AppAuthTargetType.TENANT
      ? info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN)
      : info.tenantRoles.includes(TenantRole.TENANT_ADMIN);
  });

  const info = await auth(req, res);
  if (!info) {
    return;
  }

  const client = getClient(AppAuthorizationServiceClient);

  return await asyncUnaryCall(client, "getTargetAppAuthorizations", {
    page,
    pageSize,
    clusterId,
    targetType: formatTargetTypeProto(targetType),
    filterTargetName,
    tenantName: targetType === AppAuthTargetType.ACCOUNT ? info.tenant : undefined,
    filterAccountOwnerIdOrName: targetType === AppAuthTargetType.ACCOUNT ? filterAccountOwnerIdOrName : undefined,
  })
    .then((reply) => ({
      200: {
        appLists: reply.appLists.map((x) => ({
          ...x,
          accountOwnerId:
            targetType === AppAuthTargetType.ACCOUNT ? safeGetStringProperty(x.accountOwnerId) : undefined,
          accountOwnerName:
            targetType === AppAuthTargetType.ACCOUNT ? safeGetStringProperty(x.accountOwnerName) : undefined,
        })),
        totalCount: reply.totalCount,
      },
    }))
    .catch(
      handlegRPCError({
        [status.FAILED_PRECONDITION]: (e) => ({
          409: {
            code: "FAILED_PRECONDITION" as const,
            message: e.message,
          },
        }),
        [status.INVALID_ARGUMENT]: (e) => ({
          400: {
            code: "INVALID_ARGUMENT" as const,
            message: e.message,
          },
        }),
      }),
    );
});
