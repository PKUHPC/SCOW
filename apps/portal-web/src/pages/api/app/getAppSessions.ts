/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { AppServiceClient } from "@scow/protos/build/portal/app";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

// Cannot use AppSession from protos
export const AppSession = Type.Object({
  clusterId: Type.String(),
  sessionId: Type.String(),
  jobName: Type.String(),
  jobId: Type.Number(),
  submitTime: Type.Optional(Type.String()),
  appId: Type.String(),
  appName: Type.Optional(Type.String()),
  state: Type.String(),
  dataPath: Type.String(),
  runningTime: Type.String(),
  timeLimit: Type.String(),
  reason: Type.Optional(Type.String()),
  host: Type.Optional(Type.String()),
  port: Type.Optional(Type.Number()),
  user: Type.Optional(Type.String()),
  proxyServer:Type.Optional(Type.String()),
  appType: Type.Optional(Type.String()),
  connectPath: Type.Optional(Type.String()),
});
export type AppSession = Static<typeof AppSession>;

export const GetAppSessionsSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    clusters: Type.Array(Type.String()),
  }),

  responses: {
    200: Type.Object({
      sessions: Type.Array(AppSession),
    }),
  },
});

const auth = authenticate(() => true);

export default /* #__PURE__*/route(GetAppSessionsSchema, async (req, res) => {


  const info = await auth(req, res);

  if (!info) { return; }

  const { clusters } = req.query;

  const client = getClient(AppServiceClient);

  return asyncUnaryCall(client, "listAppSessions", {
    clusters, userId: info.identityId,
  }).then((reply) => {
    return { 200: { sessions: reply.sessions } };
  });

});
