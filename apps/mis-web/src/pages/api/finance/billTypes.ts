import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { BillServiceClient } from "@scow/protos/build/server/bill";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

export const GetBillTypesSchema = typeboxRouteSchema({
  method: "GET",
  responses: {
    200: Type.Object({
      types: Type.Array(Type.String()),
    }),
  },
});

const auth = authenticate(() => true);

export default route(GetBillTypesSchema, async (req, res) => {

  await auth(req, res);
  const client = getClient(BillServiceClient);

  const reply = await asyncClientCall(client, "getBillTypes", {});

  return {
    200: {
      ...reply,
    },
  };
});
