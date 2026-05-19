import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { ClusterConfigSchema } from "@scow/config/build/cluster";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { validateToken } from "src/auth/token";
import { getClusterConfigFiles } from "src/server/clusterConfig";
import { route } from "src/utils/route";

export const getClusterConfigFilesSchema = typeboxRouteSchema({
  method: "GET",

  // only set the query value when firstly used in getInitialProps
  query: Type.Object({
    token: Type.Optional(Type.String()),
  }),

  responses: {
    200: Type.Object({
      clusterConfigs: Type.Record(Type.String(), ClusterConfigSchema),
    }),
  },
});

const auth = authenticate(() => true);

export default route(getClusterConfigFilesSchema, async (req, res) => {
  const { token } = req.query;
  // when firstly used in getInitialProps, check the token
  // when logged in, use auth()
  const info = token ? await validateToken(token) : await auth(req, res);
  if (!info) {
    return;
  }

  const modifiedClusters: Record<string, ClusterConfigSchema> = await getClusterConfigFiles();

  return {
    200: { clusterConfigs: modifiedClusters },
  };
});
