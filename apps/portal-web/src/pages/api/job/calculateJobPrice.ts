import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { moneyToNumber } from "@scow/lib-decimal";
import { JobServiceClient } from "@scow/protos/build/portal/job";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

export const CalculateJobPriceSchema = typeboxRouteSchema({
  method: "GET",
  query: Type.Object({
    cluster: Type.String(),
    partition: Type.String(),
    qos: Type.String(),
    accountName: Type.String(),
    cpusAlloc: Type.Number(),
    gpu: Type.Number(),
    memMb: Type.Number(),
    timeSeconds: Type.Number(),
  }),
  responses: {
    200: Type.Object({
      accountPrice: Type.Number(),
    }),
    403: Type.Null(),
  },
});

const auth = authenticate(() => true);

export default route(CalculateJobPriceSchema, async (req, res) => {
  const info = await auth(req, res);
  if (!info) { return; }

  const { cluster, partition, qos, accountName, cpusAlloc, gpu, memMb, timeSeconds } = req.query;
  const client = getClient(JobServiceClient);

  return asyncUnaryCall(client, "calculateJobPrice", {
    cluster,
    partition,
    qos,
    accountName,
    cpusAlloc,
    gpu,
    memMb,
    timeSeconds,
  }).then(({ accountPrice }) => ({
    200: { accountPrice: accountPrice ? moneyToNumber(accountPrice) : 0 },
  }));
});
