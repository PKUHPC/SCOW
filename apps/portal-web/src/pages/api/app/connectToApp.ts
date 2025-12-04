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
import { status } from "@grpc/grpc-js";
import { AppServiceClient, WebAppProps_ProxyType } from "@scow/protos/build/portal/app";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";
import { handlegRPCError } from "src/utils/server";

// Cannot use ServerConnectPropsConfig from appConfig package
export const AppConnectProps = Type.Object({
  method: Type.String(),
  path: Type.String(),
  query: Type.Optional(Type.Record(Type.String(), Type.String())),
  formData: Type.Optional(Type.Record(Type.String(), Type.String())),
});
export type AppConnectProps = Static<typeof AppConnectProps>;

export const ConnectToAppSchema = typeboxRouteSchema({
  method: "POST",

  body: Type.Object({
    cluster: Type.String(),
    sessionId: Type.String(),
    jobId: Type.Number(),
  }),

  responses: {

    200: Type.Intersect([
      Type.Object({
        host: Type.String(),
        port: Type.Number(),
        password: Type.Optional(Type.String()),
      }),
      Type.Union([
        Type.Object({
          type: Type.Literal("web"),
          connect: AppConnectProps,
          proxyType: Type.Union([
            Type.Literal("relative"),
            Type.Literal("absolute"),
          ]),
          customFormData: Type.Optional(Type.Record(Type.String(), Type.String())),
        }),
        Type.Object({ type: Type.Literal("vnc") }),
        Type.Object({
          type: Type.Literal("shadowDesk"),
          connect: AppConnectProps,
          customFormData: Type.Optional(Type.Record(Type.String(), Type.String())),
        }),
      ]),
    ]),

    // sessionId not exists
    404: Type.Object({ code: Type.Literal("SESSION_ID_NOT_FOUND") }),

    // the session cannot be connected
    409: Type.Object({ code: Type.Literal("SESSION_NOT_AVAILABLE") }),

  },
});

const auth = authenticate(() => true);

export default /* #__PURE__*/route(ConnectToAppSchema, async (req, res) => {

  const info = await auth(req, res);

  if (!info) { return; }

  const { cluster, sessionId, jobId } = req.body;

  const client = getClient(AppServiceClient);

  return await asyncUnaryCall(client, "connectToApp", {
    userId: info.identityId, cluster, sessionId, jobId,
  }).then(async (x) => {
    if (x.appProps?.$case === "web") {
      const connect: AppConnectProps = {
        method: x.appProps.web.method,
        path: x.appProps.web.path,
        query: x.appProps.web.query ?? {},
        formData: x.appProps.web.formData ?? {},
      };

      return {
        200: {
          host: x.host,
          port: x.port,
          password: x.password,
          type: "web" as const,

          connect: connect,

          proxyType: x.appProps.web.proxyType === WebAppProps_ProxyType.RELATIVE
            ? "relative" as const
            : "absolute" as const,
          customFormData: x.appProps.web.customFormData,
        },
      };
    }
    else if (x.appProps?.$case === "shadowDesk") {
      const connect: AppConnectProps = {
        method: x.appProps.shadowDesk.method,
        path: x.appProps.shadowDesk.path,
        query: x.appProps.shadowDesk.query ?? {},
        formData: x.appProps.shadowDesk.formData ?? {},
      };

      return {
        200: {
          host: x.host,
          port: x.port,
          password: x.password,
          type: "shadowDesk" as const,
          connect: connect,
          customFormData: x.appProps.shadowDesk.customFormData,
        },
      };
    }
    else {
      return {
        200: {
          host: x.host,
          port: x.port,
          password: x.password,
          type: "vnc" as const,
        },
      };
    }
  }, handlegRPCError({
    [status.NOT_FOUND]: () => ({ 404: { code: "SESSION_ID_NOT_FOUND" } } as const),
    [status.UNAVAILABLE]: () => ({ 409: { code: "SESSION_NOT_AVAILABLE" } } as const),
  }));


});


