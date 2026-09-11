import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { status } from "@grpc/grpc-js";
import { numberToMoney } from "@scow/lib-decimal";
import { StorageBillingServiceClient } from "@scow/protos/build/server/storage_billing";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { PlatformRole, TenantRole } from "src/models/User";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";
import { handlegRPCError } from "src/utils/server";

export const AddStorageBillingItemSchema = typeboxRouteSchema({
  method: "POST",

  body: Type.Object({
    storageId: Type.String(),
    billingMode: Type.Number(),
    tiers: Type.Array(Type.Object({
      startTb: Type.Number(),
      pricePerTbPerDay: Type.Number(),
    })),
    originalTiers: Type.Optional(Type.Array(Type.Object({
      startSize: Type.Number(),
      endSize: Type.Optional(Type.Number()),
      unit: Type.Union([Type.Literal("GB"), Type.Literal("TB")]),
      pricePerTbPerDay: Type.Number(),
    }))),
    tenantName: Type.Optional(Type.String()),
    description: Type.Optional(Type.String()),
  }),

  responses: {
    200: Type.Object({ id: Type.Number() }),
    404: Type.Object({ code: Type.Literal("TENANT_NOT_FOUND") }),
    400: Type.Object({ code: Type.Literal("INVALID_ARGUMENT") }),
  },
});

export default /* #__PURE__*/route(AddStorageBillingItemSchema, async (req, res) => {
  const { storageId, billingMode, tiers, originalTiers, tenantName, description } = req.body;

  const auth = authenticate((u) =>
    u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN) ||
    (u.tenant === tenantName && u.tenantRoles.includes(TenantRole.TENANT_ADMIN)),
  );
  const info = await auth(req, res);
  if (!info) return;

  const client = getClient(StorageBillingServiceClient);

  return await asyncClientCall(client, "addStorageBillingItem", {
    storageId,
    billingMode,
    tiers: tiers.map((t) => ({
      startTb: t.startTb,
      pricePerTbPerDay: numberToMoney(t.pricePerTbPerDay),
    })),
    originalTiers: (originalTiers ?? []).map((t) => ({
      startSize: t.startSize,
      endSize: t.endSize,
      unit: t.unit,
      pricePerTbPerDay: numberToMoney(t.pricePerTbPerDay),
    })),
    tenantName,
    description: description ?? "",
  })
    .then((result) => ({ 200: { id: result.id } }))
    .catch(handlegRPCError({
      [status.NOT_FOUND]: () => ({ 404: { code: "TENANT_NOT_FOUND" } } as const),
      [status.INVALID_ARGUMENT]: () => ({ 400: { code: "INVALID_ARGUMENT" } } as const),
    }));
});
