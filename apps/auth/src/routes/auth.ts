import { Static, Type } from "@sinclair/typebox";
import fp from "fastify-plugin";
import { validateCallbackHostname } from "src/auth/callback";

const QuerystringSchema = Type.Object({
  callbackUrl: Type.String({ description: "回调地址" }),
});

export const authRoute = fp(async (f) => {
  f.get<{ Querystring: Static<typeof QuerystringSchema> }>(
    "/public/auth",
    {
      schema: {
        querystring: QuerystringSchema,
      },
    },
    async (req, rep) => {
      const callbackUrl = req.query.callbackUrl;

      await validateCallbackHostname(callbackUrl, req);

      await f.auth.serveLoginHtml(callbackUrl, req, rep);
    },
  );
});
