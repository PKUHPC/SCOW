import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import {
  AdminServiceClient,
  ListAccountUserSynchronizationsResponse_SyncExceptionType,
  ListAccountUserSynchronizationsResponse_SyncResult as SyncResult,
  ListAccountUserSynchronizationsResponse_SyncStatus as SyncStatus,
} from "@scow/protos/build/server/admin";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { PlatformRole } from "src/models/User";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

const AccountOperationResult = Type.Object({
  accountName: Type.String(),
  success: Type.Boolean(),
  failureMessage: Type.Optional(Type.String()),
});

const AccountUserOperationResult = Type.Object({
  accountName: Type.String(),
  userId: Type.String(),
  success: Type.Boolean(),
  failureMessage: Type.Optional(Type.String()),
});

const UserOperationResult = Type.Object({
  userId: Type.String(),
  success: Type.Boolean(),
  failureMessage: Type.Optional(Type.String()),
});

const SyncDetailsSummary = Type.Object({
  createAccount: Type.Optional(
    Type.Object({
      results: Type.Array(AccountOperationResult),
    }),
  ),
  blockAccount: Type.Optional(
    Type.Object({
      results: Type.Array(AccountOperationResult),
    }),
  ),
  unblockAccount: Type.Optional(
    Type.Object({
      results: Type.Array(AccountOperationResult),
    }),
  ),
  addUserToAccount: Type.Optional(
    Type.Object({
      results: Type.Array(AccountUserOperationResult),
    }),
  ),
  blockUserInAccount: Type.Optional(
    Type.Object({
      results: Type.Array(AccountUserOperationResult),
    }),
  ),
  removeUserFromAccount: Type.Optional(
    Type.Object({
      results: Type.Array(AccountUserOperationResult),
    }),
  ),
  unblockUserInAccount: Type.Optional(
    Type.Object({
      results: Type.Array(AccountUserOperationResult),
    }),
  ),
  deleteAccount: Type.Optional(
    Type.Object({
      results: Type.Array(AccountOperationResult),
    }),
  ),
  deleteUser: Type.Optional(
    Type.Object({
      results: Type.Array(UserOperationResult),
    }),
  ),
});

export const SyncException = Type.Object({
  exceptionType: Type.Enum(ListAccountUserSynchronizationsResponse_SyncExceptionType),
  exceptionMessage: Type.String(),
});
export const ClusterTotalSyncResult = Type.Object({
  clusterId: Type.String(),
  clusterSyncStatus: Type.Enum(SyncStatus),
  clusterSyncResult: Type.Optional(Type.Enum(SyncResult)),
  executedChunkCount: Type.Number(),
  isAllChunkExecuted: Type.Boolean(),
  completedTotalSyncCount: Type.Number(),
  successfulTotalSyncCount: Type.Number(),
  clusterSyncExceptions: Type.Array(SyncException),
  clusterSyncDetails: Type.Optional(SyncDetailsSummary),
});
export const ClusterSyncResults = Type.Array(ClusterTotalSyncResult);
export type ClusterSyncResults = Static<typeof ClusterSyncResults>;

export const SyncAccountUserHistory = Type.Object({
  sessionId: Type.String(),
  operatorId: Type.Optional(Type.String()),
  operatorName: Type.Optional(Type.String()),
  sessionSyncStatus: Type.Enum(SyncStatus),
  sessionSyncResult: Type.Optional(Type.Enum(SyncResult)),
  startTime: Type.Optional(Type.String({ format: "date-time" })),
  endTime: Type.Optional(Type.String({ format: "date-time" })),
  sessionSyncDetails: Type.Optional(
    Type.Object({
      results: ClusterSyncResults,
    }),
  ),
});
export type SyncAccountUserHistory = Static<typeof SyncAccountUserHistory>;

export const GetSyncAccountUserHistorySchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    /**
     * @minimum 1
     * @type integer
     */
    page: Type.Optional(Type.Integer({ minimum: 1 })),

    /**
     * @type integer
     */
    pageSize: Type.Optional(Type.Integer()),
  }),

  responses: {
    200: Type.Object({
      syncHistory: Type.Array(SyncAccountUserHistory),
      totalCount: Type.Number(),
    }),
  },
});
const auth = authenticate((info) => info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN));

export default route(GetSyncAccountUserHistorySchema, async (req, res) => {
  const info = await auth(req, res);
  if (!info) {
    return;
  }

  const { page, pageSize } = req.query;

  const client = getClient(AdminServiceClient);

  const reply = await asyncClientCall(client, "listAccountUserSynchronizations", {
    page,
    pageSize,
  });

  return { 200: { syncHistory: reply.syncSessionInfos, totalCount: reply.totalCount } };
});
