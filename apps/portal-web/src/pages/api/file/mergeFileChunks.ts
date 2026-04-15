import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { Type } from "@sinclair/typebox";
import { route } from "src/utils/route";

export const MergeFileChunksSchema = typeboxRouteSchema({
  method: "POST",

  body: Type.Object({
    cluster: Type.String(),
    path: Type.String(),
    name: Type.String(),
    sizeByte: Type.Number(),
  }),

  responses: {
    410: Type.Object({ code: Type.Literal("DEPRECATED") }),
  },
});

export default route(MergeFileChunksSchema, () => {
  return { 410: { code: "DEPRECATED" as const } };
});
