import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { ConfigServiceClient } from "@scow/protos/build/common/config";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { getClient } from "src/utils/client";
import { runtimeConfig } from "src/utils/config";
import { route } from "src/utils/route";

export const Partition = Type.Object({
  name: Type.String(),
  memMb: Type.Number(),
  cores: Type.Number(),
  gpus: Type.Number(),
  nodes: Type.Number(),
  qos: Type.Optional(Type.Array(Type.String())),
  comment: Type.Optional(Type.String()),
});

export type Partition = Static<typeof Partition>;

export const PublicClusterConfig = Type.Object({
  submitJobDirTemplate: Type.String(),
  scheduler: Type.Object({
    name: Type.String(),
    partitions: Type.Array(Partition),
  }),
});

export type PublicClusterConfig = Static<typeof PublicClusterConfig>;

export const GetClusterInfoSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    cluster: Type.String(),
  }),

  responses: {
    200: Type.Object({
      clusterInfo: PublicClusterConfig,
    }),

    403: Type.Null(),

  },
});

const auth = authenticate(() => true);

export default route(GetClusterInfoSchema, async (req, res) => {

  const info = await auth(req, res);

  if (!info) { return; }

  const { cluster } = req.query;

  const client = getClient(ConfigServiceClient);

  const reply = await asyncUnaryCall(client, "getClusterConfig", {
    cluster,
  });

  return { 200: { clusterInfo: {
    submitJobDirTemplate: runtimeConfig.SUBMIT_JOB_WORKING_DIR,
    scheduler: {
      name: reply.schedulerName,
      partitions: reply.partitions,
    },
  } } };

});
