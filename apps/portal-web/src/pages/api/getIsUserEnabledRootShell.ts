import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { libQueryIsUserEnabledRootShell } from "@scow/lib-web/build/server/user";
import { Type } from "@sinclair/typebox";
import { getTokenFromCookie } from "src/auth/cookie";
import { authenticate } from "src/auth/server";
import { validateToken } from "src/auth/token";
import { publicConfig, runtimeConfig } from "src/utils/config";
import { route } from "src/utils/route";

export const GetIsUserEnabledRootShellSchema = typeboxRouteSchema({

  method: "GET",

  responses: {
    200: Type.Object({
      result: Type.Boolean(),
    }),

    403: Type.Null(),
  },
});

const auth = authenticate(() => true);
export default route(GetIsUserEnabledRootShellSchema,
  async (req, res) => {

    const token = getTokenFromCookie({ req });

    // when firstly used in getInitialProps, check the token
    const info = token ? await validateToken(token) : await auth(req, res);
    if (!info) { return; }

    const userId = info.identityId;

    const result =
      await libQueryIsUserEnabledRootShell(userId, publicConfig.MIS_SERVER_URL, runtimeConfig.SCOW_API_AUTH_TOKEN);

    return {
      200: result,
    };
  });
