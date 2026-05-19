import { join } from "path";
import { UploadQuery } from "src/app/(auth)/files/upload/route";

export const urlToDownload = (clusterId: string, path: string, download: boolean, basePath: string): string => {
  const searchParams = new URLSearchParams({
    path: path,
    clusterId,
    download: String(download) as "true" | "false",
  });

  return join(basePath, "/api/file/download") + "?" + searchParams.toString();
};
export const urlToUpload = (
  clusterId: string,
  path: string,
  basePath: string,
  chunk?: boolean,
  originPath?: string,
  chunkIdx?: number,
): string => {
  const searchParams = new URLSearchParams({
    path: path,
    clusterId,
    chunk: String(chunk ?? false),
    originPath: originPath ?? "",
    chunkIdx: chunkIdx !== undefined ? String(chunkIdx) : "",
  } satisfies UploadQuery);

  return join(basePath, "/files/upload") + "?" + searchParams.toString();
};
