import { readFileSync } from "fs";

export interface AdapterCertificatesConfig {
  ADAPTER_SSL_ENABLED: boolean;
  ADAPTER_SSL_CA_CERT_PATH: string;
  ADAPTER_SSL_SCOW_CERT_PATH: string;
  ADAPTER_SSL_SCOW_PRIVATE_KEY_PATH: string;
}

export interface SslConfig {
  enabled: boolean;
  ca?: Buffer;
  key?: Buffer;
  cert?: Buffer;
}

export const createAdapterCertificates = (config: AdapterCertificatesConfig) => {
  return config.ADAPTER_SSL_ENABLED
    ? {
        enabled: true,
        ca: readFileSync(config.ADAPTER_SSL_CA_CERT_PATH),
        key: readFileSync(config.ADAPTER_SSL_SCOW_PRIVATE_KEY_PATH),
        cert: readFileSync(config.ADAPTER_SSL_SCOW_CERT_PATH),
      }
    : { enabled: false };
};
