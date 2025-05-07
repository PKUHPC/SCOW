import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { InitServiceClient } from "@scow/protos/build/server/init";
import { Type } from "@sinclair/typebox";
import { getClient } from "src/utils/client";
import { queryIfInitialized } from "src/utils/init";
import { route } from "src/utils/route";

export const CompleteInitSchema = typeboxRouteSchema({
  method: "POST",

  responses: {
    204: Type.Null(),

    409: Type.Object({ code: Type.Literal("ALREADY_INITIALIZED") }),
  },
});

export default route(CompleteInitSchema, async () => {
  const result = await queryIfInitialized();

  if (result) { return { 409: { code: "ALREADY_INITIALIZED" as const } }; }

  const client = getClient(InitServiceClient);

  await asyncClientCall(client, "completeInit", {});

  return { 204: null };
});


