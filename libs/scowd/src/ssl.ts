import { readFileSync } from "fs";

export interface ScowdCertificatesConfig {
  SCOWD_SSL_ENABLED: boolean;
  SCOWD_SSL_CA_CERT_PATH: string;
  SCOWD_SSL_SCOW_CERT_PATH: string;
  SCOWD_SSL_SCOW_PRIVATE_KEY_PATH: string;
}

export interface SslConfig {
  ca?: Buffer;
  key?: Buffer;
  cert?: Buffer;
}

export const createScowdCertificates = (config: ScowdCertificatesConfig) => {
  return config.SCOWD_SSL_ENABLED
    ? {
        ca: readFileSync(config.SCOWD_SSL_CA_CERT_PATH),
        key: readFileSync(config.SCOWD_SSL_SCOW_PRIVATE_KEY_PATH),
        cert: readFileSync(config.SCOWD_SSL_SCOW_CERT_PATH),
      }
    : {};
};
