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
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { isPortReachableThroughUrl } from "src/utils/isPortReachable";
import { route } from "src/utils/route";

export const CheckAppConnectivitySchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    cluster: Type.String(),
    host: Type.String(),
    port: Type.Number(),
    appType: Type.Union([
      Type.Literal("web"),
      Type.Literal("vnc"),
    ]),
    proxyType: Type.Optional(Type.Union([
      Type.Literal("relative"),
      Type.Literal("absolute"),
    ])),
  }),

  responses: {
    200: Type.Object({ ok: Type.Boolean() }),
  },
});

const auth = authenticate(() => true);

const TIMEOUT_MS = 3000;

export default /* #__PURE__*/route(CheckAppConnectivitySchema, async (req, res) => {

  const info = await auth(req, res);

  if (!info) { return; }

  const { cluster, host, port, proxyType, appType } = req.query;

  // ignore proxy gateway, check the url directly
  const checkUrl = await isPortReachableThroughUrl(
    req, TIMEOUT_MS, cluster, host, port, appType, proxyType);

  return { 200: { ok: checkUrl } };

});
