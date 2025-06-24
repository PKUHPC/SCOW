import { ChannelCredentials, ClientOptions } from "@grpc/grpc-js";

export type ClientConstructor<TClient> =
  new (address: string, credentials: ChannelCredentials, options?: ClientOptions) => TClient;

export const getClientFn = (
  config: {
    SERVER_URL: string;
    SCOW_API_AUTH_TOKEN?: string;
  },
) => <TClient>(
  ctor: ClientConstructor<TClient>,
): TClient => {
  return new ctor(
    config.SERVER_URL,
    ChannelCredentials.createInsecure(),
    config.SCOW_API_AUTH_TOKEN ?
      {
        callInvocationTransformer: (props) => {
          props.metadata.add("authorization", `Bearer ${config.SCOW_API_AUTH_TOKEN}`);
          return props;
        },
      } : undefined,
  );
};
