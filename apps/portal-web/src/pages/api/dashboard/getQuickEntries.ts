import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { DashboardServiceClient } from "@scow/protos/build/portal/dashboard";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

const PageLinkEntry = Type.Object({
  path: Type.String(),
  icon: Type.String(),
});

const ShellEntry = Type.Object({
  clusterId: Type.String(),
  loginNode: Type.String(),
  icon: Type.String(),
});

const AppEntry = Type.Object({
  appId: Type.String(),
  clusterId: Type.String(),
  appLogoPath: Type.Optional(Type.String()),
});

const ClusterPageLinkEntry = Type.Object({
  path: Type.String(),
  clusterId: Type.String(),
  icon: Type.String(),
});

export const Entry = Type.Object({
  id: Type.String(),
  name: Type.String(),
  entry: Type.Optional(
    Type.Union([
      Type.Object({
        $case: Type.Literal("pageLink"),
        pageLink: PageLinkEntry,
      }),
      Type.Object({
        $case: Type.Literal("shell"),
        shell: ShellEntry,
      }),
      Type.Object({
        $case: Type.Literal("app"),
        app: AppEntry,
      }),
      Type.Object({
        $case: Type.Literal("clusterPageLink"),
        clusterPageLink: ClusterPageLinkEntry,
      }),
    ]),
  ),
});
export type Entry = Static<typeof Entry>;

export const GetQuickEntriesSchema = typeboxRouteSchema({
  method: "GET",

  responses: {
    200: Type.Object({
      quickEntries: Type.Array(Entry),
    }),

    404: Type.Object({ code: Type.Literal("READ_FILE_FAILED") }),
  },
});

const auth = authenticate(() => true);

export default route(GetQuickEntriesSchema, async (req, res) => {
  const info = await auth(req, res);

  if (!info) {
    return;
  }

  const client = getClient(DashboardServiceClient);

  return await asyncUnaryCall(client, "getQuickEntries", {
    userId: info.identityId,
  }).then(async (x) => {
    return { 200: { quickEntries: x.quickEntries } };
  });
});
