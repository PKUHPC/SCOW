import { join } from "path";
import { publicConfig } from "src/utils/config";

export const urlToCompressAndDownload = (cluster: string, path: string[], download: boolean): string => {
  const pathParams = path.map((p) => `paths=${encodeURIComponent(p)}`).join("&");

  // eslint-disable-next-line @stylistic/max-len
  return `${join(publicConfig.BASE_PATH, "/api/file/compressAndDownload")}?${pathParams}&cluster=${cluster}&download=${download}`;
};

export const urlToDownload = (cluster: string, path: string, download: boolean): string => {
  return (
    join(publicConfig.BASE_PATH, "/api/file/download") +
    `?path=${encodeURIComponent(path)}&cluster=${cluster}&download=${download}`
  );
};
export const urlToUpload = (
  cluster: string,
  path: string,
  chunk?: boolean,
  originPath?: string,
  chunkIdx?: number,
): string => {
  return (
    join(publicConfig.BASE_PATH, "/api/file/upload") +
    `?path=${encodeURIComponent(path)}&cluster=${cluster}` +
    (chunkIdx !== undefined ? `&chunkIdx=${chunkIdx}` : "") +
    `&chunk=${chunk ?? false}&originPath=${originPath ?? ""}`
  );
};
