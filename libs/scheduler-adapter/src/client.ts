import { ChannelCredentials } from "@grpc/grpc-js";
import { AccountServiceClient } from "@scow/scheduler-adapter-protos/build/account";
import { AppServiceClient } from "@scow/scheduler-adapter-protos/build/app";
import { ConfigServiceClient } from "@scow/scheduler-adapter-protos/build/config";
import { JobServiceClient } from "@scow/scheduler-adapter-protos/build/job";
import { NodeServiceClient } from "@scow/scheduler-adapter-protos/build/node";
import { UserServiceClient } from "@scow/scheduler-adapter-protos/build/user";
import { VersionServiceClient } from "@scow/scheduler-adapter-protos/build/version";

import { SslConfig } from "./ssl";

type ClientConstructor<TClient> = new (address: string, credentials: ChannelCredentials) => TClient;

export interface SchedulerAdapterClient {
  account: AccountServiceClient;
  user: UserServiceClient;
  job: JobServiceClient;
  config: ConfigServiceClient;
  node: NodeServiceClient;
  version: VersionServiceClient;
  app: AppServiceClient;
}

export function getClient<TClient>(address: string, sslConfig: SslConfig, ctor: ClientConstructor<TClient>): TClient {
  if (sslConfig.enabled) {
    return new ctor(address, ChannelCredentials.createSsl(sslConfig.ca, sslConfig.key, sslConfig.cert));
  }

  return new ctor(address, ChannelCredentials.createInsecure());
}

export const getSchedulerAdapterClient = (address: string, sslConfig: SslConfig) => {
  return {
    account: getClient(address, sslConfig, AccountServiceClient),
    user: getClient(address, sslConfig, UserServiceClient),
    job: getClient(address, sslConfig, JobServiceClient),
    config: getClient(address, sslConfig, ConfigServiceClient),
    node: getClient(address, sslConfig, NodeServiceClient),
    version: getClient(address, sslConfig, VersionServiceClient),
    app: getClient(address, sslConfig, AppServiceClient),
  } as SchedulerAdapterClient;
};
