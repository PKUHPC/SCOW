import {
  CallInvocationTransformer,
  ChannelCredentials,
  ClientOptions,
  Deadline,
  requestCallback,
  ServiceError,
  status,
} from "@grpc/grpc-js";
import { AccountServiceClient } from "@scow/scheduler-adapter-protos/build/account";
import { AppServiceClient } from "@scow/scheduler-adapter-protos/build/app";
import { ConfigServiceClient } from "@scow/scheduler-adapter-protos/build/config";
import { JobServiceClient } from "@scow/scheduler-adapter-protos/build/job";
import { NodeServiceClient } from "@scow/scheduler-adapter-protos/build/node";
import { UserServiceClient } from "@scow/scheduler-adapter-protos/build/user";
import { VersionServiceClient } from "@scow/scheduler-adapter-protos/build/version";

import { SslConfig } from "./ssl";

type ClientConstructor<TClient> = new (
  address: string,
  credentials: ChannelCredentials,
  options?: Partial<ClientOptions>,
) => TClient;

export const DEFAULT_SCHEDULER_ADAPTER_TIMEOUT_MS = 60 * 1000;

export interface SchedulerAdapterClientOptions {
  timeoutMs?: number;
}

export interface SchedulerAdapterClient {
  account: AccountServiceClient;
  user: UserServiceClient;
  job: JobServiceClient;
  config: ConfigServiceClient;
  node: NodeServiceClient;
  version: VersionServiceClient;
  app: AppServiceClient;
}

const getTimeoutSeconds = (timeoutMs: number) => Math.ceil(timeoutMs / 1000);

const getDeadlineTimeoutMs = (deadline: Deadline, fallbackTimeoutMs: number) => {
  if (deadline instanceof Date) {
    return Math.max(0, deadline.getTime() - Date.now());
  }

  if (typeof deadline === "number") {
    return Math.max(0, deadline - Date.now());
  }

  return fallbackTimeoutMs;
};

const rewriteDeadlineExceededError = (error: ServiceError, timeoutMs: number) => {
  if (error.code !== status.DEADLINE_EXCEEDED) {
    return error;
  }

  const message = `Scheduler adapter call timed out after ${getTimeoutSeconds(timeoutMs)}s.`;
  error.message = message;
  error.details = message;
  return error;
};

export const createSchedulerAdapterCallInvocationTransformer = (
  timeoutMs: number,
): CallInvocationTransformer => {
  return (callProperties) => {
    const { methodDefinition } = callProperties;
    const isUnaryCall = !methodDefinition.requestStream && !methodDefinition.responseStream;

    if (!isUnaryCall) {
      return callProperties;
    }

    const deadline = callProperties.callOptions.deadline ?? Date.now() + timeoutMs;
    const deadlineTimeoutMs = getDeadlineTimeoutMs(deadline, timeoutMs);
    const callback = callProperties.callback;
    const wrappedCallback: requestCallback<any> | undefined = callback
      ? (error, value) => {
          callback(error ? rewriteDeadlineExceededError(error, deadlineTimeoutMs) : null, value);
        }
      : undefined;

    return {
      ...callProperties,
      callback: wrappedCallback,
      callOptions: {
        ...callProperties.callOptions,
        deadline,
      },
    };
  };
};

export function getClient<TClient>(
  address: string,
  sslConfig: SslConfig,
  ctor: ClientConstructor<TClient>,
  options: SchedulerAdapterClientOptions = {},
): TClient {
  const timeoutMs = options.timeoutMs ?? DEFAULT_SCHEDULER_ADAPTER_TIMEOUT_MS;
  const clientOptions: Partial<ClientOptions> = {
    callInvocationTransformer: createSchedulerAdapterCallInvocationTransformer(timeoutMs),
  };

  if (sslConfig.enabled) {
    return new ctor(address, ChannelCredentials.createSsl(sslConfig.ca, sslConfig.key, sslConfig.cert), clientOptions);
  }

  return new ctor(address, ChannelCredentials.createInsecure(), clientOptions);
}

export const getSchedulerAdapterClient = (
  address: string,
  sslConfig: SslConfig,
  options: SchedulerAdapterClientOptions = {},
) => {
  return {
    account: getClient(address, sslConfig, AccountServiceClient, options),
    user: getClient(address, sslConfig, UserServiceClient, options),
    job: getClient(address, sslConfig, JobServiceClient, options),
    config: getClient(address, sslConfig, ConfigServiceClient, options),
    node: getClient(address, sslConfig, NodeServiceClient, options),
    version: getClient(address, sslConfig, VersionServiceClient, options),
    app: getClient(address, sslConfig, AppServiceClient, options),
  } as SchedulerAdapterClient;
};
