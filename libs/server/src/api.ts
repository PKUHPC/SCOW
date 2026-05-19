import { Code, ConnectError, HandlerContext } from "@connectrpc/connect";
import { ChannelCredentials, ClientOptions } from "@grpc/grpc-js";
import { ScowApiConfigSchema } from "@scow/config/build/common";

export type ClientConstructor<TClient> = new (
  address: string,
  credentials: ChannelCredentials,
  options?: ClientOptions,
) => TClient;

export const getClientFn =
  (serverUrl: string, scowApiAuthToken?: string) =>
  <TClient>(ctor: ClientConstructor<TClient>): TClient => {
    return new ctor(
      serverUrl,
      ChannelCredentials.createInsecure(),
      scowApiAuthToken
        ? {
            callInvocationTransformer: (props) => {
              props.metadata.add("authorization", `Bearer ${scowApiAuthToken}`);
              return props;
            },
          }
        : undefined,
    );
  };

export async function checkScowApiToken(
  context: HandlerContext,
  config: ScowApiConfigSchema | undefined,
): Promise<null> {
  const authorization = context.requestHeader.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new ConnectError("UNAUTHORIZED", Code.Unauthenticated);
  }

  if (authorization !== `Bearer ${config?.auth?.token}`) {
    throw new ConnectError("UNAUTHORIZED", Code.Unauthenticated);
  }

  return null;
}
