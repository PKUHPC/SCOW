import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { moneyToNumber } from "@scow/lib-decimal";
import { ChargingServiceClient } from "@scow/protos/build/server/charging";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { PlatformRole } from "src/models/User";
import { ensureNotUndefined } from "src/utils/checkNull";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

export const TenantPaymentInfo = Type.Object({
  index: Type.Number(),
  tenantName: Type.String(),
  time: Type.String(),
  type: Type.String(),
  amount: Type.Number(),
  comment: Type.String(),
  ipAddress: Type.String(),
  operatorId: Type.String(),
});

export type TenantPaymentInfo = Static<typeof TenantPaymentInfo>;

export const GetTenantPaymentsSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    /**
     * @format date-time
     */
    startTime: Type.String({ format: "date-time" }),

    /**
     * @format date-time
     */
    endTime: Type.String({ format: "date-time" }),

    tenantName: Type.Optional(Type.String()),

    // 充值类型
    types:Type.Optional(Type.Array(Type.String())),
  }),

  responses: {
    200: Type.Object({
      results: Type.Array(TenantPaymentInfo),
      total: Type.Number(),
    }),
  },
});

export default route(GetTenantPaymentsSchema, async (req, res) => {
  const { endTime, startTime, tenantName, types } = req.query;

  const client = getClient(ChargingServiceClient);

  const user = await authenticate((i) => i.platformRoles.includes(PlatformRole.PLATFORM_FINANCE) ||
      i.platformRoles.includes(PlatformRole.PLATFORM_ADMIN))(req, res);
  if (!user) { return; }

  const reply = ensureNotUndefined(await asyncClientCall(client, "getPaymentRecords", {
    target:tenantName ?
      { $case:"tenant", tenant:{ tenantName:tenantName } } :
      { $case:"allTenants", allTenants:{ } },
    startTime,
    endTime,
    types:types ?? [],
  }), ["total"]);

  const tenants = reply.results.map((x) => {
    const obj = ensureNotUndefined(x, ["time", "amount"]);

    return {
      tenantName: obj.tenantName,
      comment: obj.comment,
      index:obj.index,
      ipAddress: obj.ipAddress,
      operatorId: obj.operatorId,
      time: obj.time,
      type: obj.type,
      amount: moneyToNumber(obj.amount),
    } as TenantPaymentInfo;
  });

  return {
    200: {
      results: tenants,
      total: moneyToNumber(reply.total),
    },
  };
});
