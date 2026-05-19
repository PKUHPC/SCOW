import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { isShadowDeskReachable } from "src/utils/isShadowDeskReachable";
import { route } from "src/utils/route";

export const CheckShadowDeskConnectivitySchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    id: Type.String(),
    proxyServer: Type.String(),
    connectPath: Type.String(),
  }),

  responses: {
    200: Type.Object({ ok: Type.Boolean() }),
  },
});

const auth = authenticate(() => true);

const TIMEOUT_MS = 3000;

export default /* #__PURE__*/ route(CheckShadowDeskConnectivitySchema, async (req, res) => {
  const info = await auth(req, res);

  if (!info) {
    return;
  }

  const { id, proxyServer, connectPath } = req.query;
  const reachable = await isShadowDeskReachable(id, proxyServer, TIMEOUT_MS, connectPath);

  return { 200: { ok: reachable } };
});
