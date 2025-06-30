import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { AppServiceClient } from "@scow/protos/build/portal/app";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

// Cannot use SubmissionInfo from protos
export const SubmissionInfo = Type.Object({
  userId: Type.String(),
  cluster: Type.String(),
  appId: Type.String(),
  appName: Type.String(),
  account: Type.String(),
  partition: Type.Optional(Type.String()),
  qos: Type.Optional(Type.String()),
  nodeCount: Type.Number(),
  coreCount: Type.Number(),
  gpuCount: Type.Optional(Type.Number()),
  maxTime: Type.Number(),
  submitTime: Type.Optional(Type.String()),
  customAttributes: Type.Record(Type.String(), Type.String()),
});

export type SubmissionInfo = Static<typeof SubmissionInfo>;


export const GetAppLastSubmissionSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    cluster: Type.String(),
    appId: Type.String(),
  }),

  responses: {
    200: Type.Object({
      lastSubmissionInfo: Type.Optional(SubmissionInfo),
    }),
  },
});

const auth = authenticate(() => true);

export default /* #__PURE__*/route(GetAppLastSubmissionSchema, async (req, res) => {

  const info = await auth(req, res);

  if (!info) { return; }

  const { cluster, appId } = req.query;
  const client = getClient(AppServiceClient);

  return asyncUnaryCall(client, "getAppLastSubmission", {
    userId: info.identityId, cluster, appId,
  })
    .then(({ lastSubmissionInfo }) => ({ 200: { lastSubmissionInfo: lastSubmissionInfo } }))
    .catch(() => {
      console.warn("LastSubmission found failed. It will be recreated after next submission.");
      return { 200: { lastSubmissionInfo: undefined } };
    });
});
