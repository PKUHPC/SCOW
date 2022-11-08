import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { status } from "@grpc/grpc-js";
import { authenticate } from "src/auth/server";
import { AppServiceClient, WebAppProps_ProxyType } from "src/generated/portal/app";
import { getClient } from "src/utils/client";
import { dnsResolve } from "src/utils/dns";
import { route } from "src/utils/route";
import { handlegRPCError } from "src/utils/server";

// Cannot use ServerConnectPropsConfig from appConfig package
export type AppConnectProps = {
  proxyType: WebAppProps_ProxyType;
  method: string;
  path: string;
  query?: { [key: string]: string };
  formData?: { [key: string]: string };
}

export interface ConnectToAppSchema {
  method: "POST";

  body: {
    cluster: string;
    sessionId: string;
  }

  responses: {
    200: { host: string; port: number; password: string} & (
      | { type: "web"; connect: AppConnectProps}
      | { type: "vnc"; }
    );


    // sessionId not exists
    404: { code: "SESSION_ID_NOT_FOUND" };

    // the session cannot be connected
    409: { code: "SESSION_NOT_AVAILABLE" };

  }
}

const auth = authenticate(() => true);

export default /* #__PURE__*/route<ConnectToAppSchema>("ConnectToAppSchema", async (req, res) => {

  const info = await auth(req, res);

  if (!info) { return; }

  const { cluster, sessionId } = req.body;

  const client = getClient(AppServiceClient);

  return await asyncUnaryCall(client, "connectToApp", {
    sessionId, userId: info.identityId, cluster,
  }).then(async (x) => {
    const resolvedHost = await dnsResolve(x.host);


    if (x.appProps?.$case === "web") {
      return {
        200: {
          host: resolvedHost,
          port: x.port,
          password: x.password,
          type: "web" as const,
          connect: x.appProps.web,
        },
      };
    } else {
      return {
        200: {
          host: resolvedHost,
          port: x.port,
          password: x.password,
          type: "vnc" as const,
        },
      };
    }
  }, handlegRPCError({
    [status.NOT_FOUND]: () => ({ 404: { code: "SESSION_ID_NOT_FOUND" } } as const),
    [status.UNAVAILABLE]: () => ({ 409: { code: "SESSION_NOT_AVAILABLE" } } as const),
  }));


});


