import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { JobServiceClient } from "@scow/protos/build/server/job";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { PlatformRole } from "src/models/User";
import { getClient } from "src/utils/client";
import { queryIfInitialized } from "src/utils/init";
import { route } from "src/utils/route";

export const GetMissingDefaultPriceItemsSchema = typeboxRouteSchema({
  method: "GET",

  responses: {
    200: Type.Object({ items: Type.Array(Type.String()) }),
  },
});

const auth = authenticate((info) => info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN));

export default /* #__PURE__*/ route(GetMissingDefaultPriceItemsSchema, async (req, res) => {
  // 如果还未初始化，本接口不做登录校验
  if (await queryIfInitialized()) {
    const info = await auth(req, res);
    if (!info) {
      return;
    }
  }

  const client = getClient(JobServiceClient);

  return await asyncClientCall(client, "getMissingDefaultPriceItems", {}).then((x) => ({ 200: { items: x.items } }));
});
