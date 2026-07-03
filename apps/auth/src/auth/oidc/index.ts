import type OidcClient from "openid-client";

import { FastifyInstance, FastifyRequest } from "fastify";
import { cacheInfo } from "src/auth/cacheInfo";
import { redirectToWeb, validateCallbackHostname } from "src/auth/callback";
import { serveLoginHtml } from "src/auth/loginHtml";
import { authConfig, OidcConfigSchema } from "src/config/auth";
import { ensureNotUndefined } from "src/utils/validations";

const OIDC_LOGIN_STATE_PREFIX = "auth:oidc:state:";
const OIDC_LOGIN_STATE_EXPIRE_SECONDS = 600;

type OidcClientConfiguration = OidcClient.Configuration;
type OidcTokenResponse = OidcClient.TokenEndpointResponse & OidcClient.TokenEndpointResponseHelpers;

async function getOidcClient() {
  // openid-client是仅ESM的，如果直接import会jest报错，所以这里使用动态import
  return await import("openid-client");
}

interface OidcLoginState {
  callbackUrl: string;
  codeVerifier: string;
}

type Claims = Record<string, unknown>;

function getClaim(claims: Claims, claimName: string | undefined): string | undefined {
  if (!claimName) {
    return undefined;
  }

  const value = claims[claimName];

  return typeof value === "string" && value ? value : undefined;
}

function getCurrentUrl(req: FastifyRequest, redirectUri: string) {
  const currentUrl = new URL(redirectUri);
  currentUrl.search = new URL(req.url, "http://localhost").search;

  return currentUrl;
}

function getClientAuth(oidcClient: typeof OidcClient, oidc: OidcConfigSchema) {
  return oidc.clientSecret ? oidcClient.ClientSecretPost(oidc.clientSecret) : oidcClient.None();
}

async function getOidcClientConfig(oidc: OidcConfigSchema) {
  const oidcClient = await getOidcClient();

  return oidcClient.discovery(
    new URL(oidc.issuerUrl),
    oidc.clientId,
    {
      client_secret: oidc.clientSecret,
      redirect_uris: [oidc.redirectUri],
      response_types: ["code"],
    },
    getClientAuth(oidcClient, oidc),
    oidc.allowInsecureRequests ? { execute: [oidcClient.allowInsecureRequests] } : undefined,
  );
}

async function getOidcUserInfo(
  oidc: OidcConfigSchema,
  clientConfig: OidcClientConfiguration,
  tokens: OidcTokenResponse,
) {
  const oidcClient = await getOidcClient();
  const idTokenClaims = tokens.claims();
  const expectedSubject = idTokenClaims?.sub ?? oidcClient.skipSubjectCheck;
  const userInfo = await oidcClient.fetchUserInfo(clientConfig, tokens.access_token, expectedSubject).catch((e) => {
    if (idTokenClaims) {
      return undefined;
    }

    throw e;
  });

  const claims = { ...(idTokenClaims ?? {}), ...(userInfo ?? {}) };
  const identityId = getClaim(claims, oidc.claims.identityId) ?? getClaim(claims, "sub");

  if (!identityId) {
    throw new Error(`OIDC response does not include configured identity claim ${oidc.claims.identityId}`);
  }

  return {
    identityId,
  };
}

export const registerOidcCallbackRoute = async (f: FastifyInstance) => {
  const { oidc } = ensureNotUndefined(authConfig, ["oidc"]);
  const clientConfig = await getOidcClientConfig(oidc);

  f.get("/public/oidc/callback", async (req, rep) => {
    const currentUrl = getCurrentUrl(req, oidc.redirectUri);
    const state = currentUrl.searchParams.get("state");

    if (!state) {
      return await rep.code(400).send({ code: "OIDC_STATE_MISSING" });
    }

    const stateKey = OIDC_LOGIN_STATE_PREFIX + state;
    const loginStateJson = await f.redis.getdel(stateKey);

    if (!loginStateJson) {
      return await rep.code(400).send({ code: "OIDC_STATE_INVALID" });
    }

    const loginState = JSON.parse(loginStateJson) as OidcLoginState;
    const oidcClient = await getOidcClient();

    const tokens = await oidcClient.authorizationCodeGrant(
      clientConfig,
      currentUrl,
      {
        expectedState: state,
        pkceCodeVerifier: loginState.codeVerifier,
        idTokenExpected: true,
      },
      { redirect_uri: oidc.redirectUri },
    );

    const user = await getOidcUserInfo(oidc, clientConfig, tokens);
    const existingUser = await f.auth.getUser?.(user.identityId, req);

    if (!existingUser) {
      return await serveLoginHtml(
        { err: false },
        loginState.callbackUrl,
        req,
        rep,
        undefined,
        undefined,
        undefined,
        undefined,
        {
          identityId: user.identityId,
          reason: "notFound",
        },
      );
    }

    if (existingUser.blocked) {
      return await serveLoginHtml(
        { err: false },
        loginState.callbackUrl,
        req,
        rep,
        undefined,
        undefined,
        undefined,
        undefined,
        {
          identityId: user.identityId,
          reason: "blocked",
        },
      );
    }

    const token = await cacheInfo(user.identityId, req);

    await validateCallbackHostname(loginState.callbackUrl, req);
    await redirectToWeb(loginState.callbackUrl, token, rep);
  });
};

export async function redirectToOidcLogin(callbackUrl: string, req: FastifyRequest) {
  const { oidc } = ensureNotUndefined(authConfig, ["oidc"]);
  const oidcClient = await getOidcClient();
  const clientConfig = await getOidcClientConfig(oidc);
  const codeVerifier = oidcClient.randomPKCECodeVerifier();
  const codeChallenge = await oidcClient.calculatePKCECodeChallenge(codeVerifier);
  const state = oidcClient.randomState();

  await req.server.redis.set(
    OIDC_LOGIN_STATE_PREFIX + state,
    JSON.stringify({ callbackUrl, codeVerifier } satisfies OidcLoginState),
    "EX",
    OIDC_LOGIN_STATE_EXPIRE_SECONDS,
  );

  return oidcClient.buildAuthorizationUrl(clientConfig, {
    redirect_uri: oidc.redirectUri,
    scope: oidc.scope,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
}
