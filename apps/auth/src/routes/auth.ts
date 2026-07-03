import { Static, Type } from "@sinclair/typebox";
import fp from "fastify-plugin";
import { validateCallbackHostname } from "src/auth/callback";
import { redirectToOidcLogin, registerOidcCallbackRoute } from "src/auth/oidc";
import { authConfig, LoginType } from "src/config/auth";

const QuerystringSchema = Type.Object({
  callbackUrl: Type.String({ description: "回调地址" }),
  mode: Type.Optional(Type.Union([Type.Literal("builtin"), Type.Literal("oidc")])),
});

export const authRoute = fp(async (f) => {
  if (authConfig.oidc) {
    await registerOidcCallbackRoute(f);
  }

  f.get<{ Querystring: Static<typeof QuerystringSchema> }>(
    "/public/auth",
    {
      schema: {
        querystring: QuerystringSchema,
      },
    },
    async (req, rep) => {
      const callbackUrl = req.query.callbackUrl;
      const loginMode = req.query.mode ?? authConfig.loginType;

      await validateCallbackHostname(callbackUrl, req);

      if (loginMode === LoginType.oidc) {
        const redirectTo = await redirectToOidcLogin(callbackUrl, req);
        return await rep.redirect(302, redirectTo.href);
      }

      await f.auth.serveLoginHtml(callbackUrl, req, rep);
    },
  );
});
