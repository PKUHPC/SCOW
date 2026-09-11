import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { moneyToNumber } from "@scow/lib-decimal";
import { StorageBillingServiceClient } from "@scow/protos/build/server/storage_billing";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { PlatformRole } from "src/models/User";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";
import { handlegRPCError } from "src/utils/server";

const StorageBillingItemSchema = Type.Object({
  id: Type.Number(),
  storageId: Type.String(),
  billingMode: Type.Number(),
  tiers: Type.Array(
    Type.Object({
      startTb: Type.Number(),
      pricePerTbPerDay: Type.Number(),
    }),
  ),
  originalTiers: Type.Array(
    Type.Object({
      startSize: Type.Number(),
      endSize: Type.Optional(Type.Number()),
      unit: Type.Union([Type.Literal("GB"), Type.Literal("TB")]),
      pricePerTbPerDay: Type.Number(),
    }),
  ),
  tenantName: Type.Optional(Type.String()),
  createTime: Type.String(),
  description: Type.String(),
});

export const GetStorageBillingItemsSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    storageId: Type.String(),
    tenantName: Type.Optional(Type.String()),
  }),

  responses: {
    200: Type.Object({
      activeItems: Type.Array(StorageBillingItemSchema),
      historyItems: Type.Array(StorageBillingItemSchema),
    }),
  },
});

function convertItem(item: any) {
  const tiers = (item.tiers || []).map((t: any) => ({
    startTb: t.startTb ?? (t.startGb ?? 0) / 1024,
    pricePerTbPerDay: t.pricePerTbPerDay ? moneyToNumber(t.pricePerTbPerDay) : 0,
  }));

  return {
    id: item.id,
    storageId: item.storageId,
    billingMode: item.billingMode,
    tiers,
    originalTiers: (item.originalTiers || []).map((t: any) => ({
      startSize: t.startSize,
      endSize: t.endSize,
      unit: t.unit,
      pricePerTbPerDay: t.pricePerTbPerDay ? moneyToNumber(t.pricePerTbPerDay) : 0,
    })),
    tenantName: item.tenantName,
    createTime: item.createTime || new Date().toISOString(),
    description: item.description ?? "",
  };
}

export default /* #__PURE__*/ route(GetStorageBillingItemsSchema, async (req, res) => {
  const { storageId, tenantName } = req.query;

  const auth = authenticate(
    (u) =>
      u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN) ||
      u.platformRoles.includes(PlatformRole.PLATFORM_FINANCE) ||
      !tenantName ||
      u.tenant === tenantName,
  );
  const info = await auth(req, res);
  if (!info) return;

  const targetTenantName =
    info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN) ||
    info.platformRoles.includes(PlatformRole.PLATFORM_FINANCE)
      ? tenantName
      : info.tenant;

  const client = getClient(StorageBillingServiceClient);

  return await asyncClientCall(client, "getStorageBillingItems", {
    storageId,
    tenantName: targetTenantName,
  })
    .then((result) => ({
      200: {
        activeItems: (result.activeItems || []).map(convertItem),
        historyItems: (result.historyItems || []).map(convertItem),
      },
    }))
    .catch(handlegRPCError({}));
});
