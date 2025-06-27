import type { ServiceType } from "@bufbuild/protobuf";
import { type Client, createClient } from "@connectrpc/connect";
import { ConnectTransportOptions, createConnectTransport, Http2SessionOptions } from "@connectrpc/connect-node";
import { AppService } from "@scow/scowd-protos/build/application/app_connect";
import { DesktopService } from "@scow/scowd-protos/build/application/desktop_connect";
import { ImageService } from "@scow/scowd-protos/build/application/image_connect";
import { ShellService } from "@scow/scowd-protos/build/application/shell_connect";
import { SystemService } from "@scow/scowd-protos/build/application/system_connect";
import { FileService } from "@scow/scowd-protos/build/storage/file_connect";
import { StorageQuotaService } from "@scow/scowd-protos/build/storage/storage_quota_connect";

import { SslConfig } from "./ssl";

export interface ScowdClient {
  file: Client<typeof FileService>;
  storageQuota: Client<typeof StorageQuotaService>;
  desktop: Client<typeof DesktopService>;
  app: Client<typeof AppService>;
  system: Client<typeof SystemService>;
  shell: Client<typeof ShellService>;
  image: Client<typeof ImageService>;
}
export type SafeConnectTransportOptions =
Omit<
  ConnectTransportOptions,
  "httpVersion" | "baseUrl" | "nodeOptions"
> & Http2SessionOptions
;

export function getClient<TService extends ServiceType>(
  scowdUrl: string,
  service: TService,
  certificates?: SslConfig,
  extraConnectTransportOptions?: Partial<SafeConnectTransportOptions>,
): Client<TService> {
  const transport = createConnectTransport({
    baseUrl: scowdUrl,
    httpVersion: "2",
    nodeOptions: {
      ...certificates,
    },
    ...extraConnectTransportOptions,
  });
  return createClient(service, transport);
}

export const getScowdClient = (
  scowdUrl: string,
  certificates?: SslConfig,
  extraConnectTransportOptions?: Partial<SafeConnectTransportOptions>,
) => {
  return {
    file: getClient(scowdUrl, FileService, certificates, extraConnectTransportOptions),
    storageQuota: getClient(scowdUrl, StorageQuotaService, certificates, extraConnectTransportOptions),
    desktop: getClient(scowdUrl, DesktopService, certificates, extraConnectTransportOptions),
    app: getClient(scowdUrl, AppService, certificates, extraConnectTransportOptions),
    system: getClient(scowdUrl, SystemService, certificates, extraConnectTransportOptions),
    shell: getClient(scowdUrl, ShellService, certificates, extraConnectTransportOptions),
    image: getClient(scowdUrl, ImageService, certificates, extraConnectTransportOptions),
  } as ScowdClient;
};
