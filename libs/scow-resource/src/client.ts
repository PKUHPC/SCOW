import { GenService, GenServiceMethods } from "@bufbuild/protobuf/codegenv2";
import { Client, createClient, Interceptor } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-node";
import { getCommonConfig } from "@scow/config/build/common";
import { ClusterPartitionService } from "@scow/scow-resource-protos/build/partition_pb";
import { join } from "path";

export interface ScowResourceClient {
  resource: Client<typeof ClusterPartitionService>;
}

const setAuthorization: Interceptor = (next) => async (req) => {
  const commonConfig = getCommonConfig();
  const token = commonConfig.scowApi?.auth?.token;

  if (token) {
    req.header.set("authorization", `Bearer ${token}`);
  }
  return next(req);
};

export function getClient<TService extends GenServiceMethods>(
  scowResourceUrl: string,
  service: GenService<TService>,
): Client<GenService<TService>> {
  const transport = createConnectTransport({
    baseUrl: join(scowResourceUrl, "/api"),
    httpVersion: "1.1",
    interceptors: [setAuthorization],
  });

  return createClient(service, transport);
}

export const getScowResourceClient = (scowResourceUrl: string) => {
  return {
    resource: getClient(scowResourceUrl, ClusterPartitionService),
  } as ScowResourceClient;
};
