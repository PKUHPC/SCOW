/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { join } from "path";
import { publicConfig } from "src/utils/config";

export const urlToCompressAndDownload = (cluster: string, path: string[], download: boolean): string => {
  const pathParams = path.map((p) => `paths=${encodeURIComponent(p)}`).join("&");

  // eslint-disable-next-line @stylistic/max-len
  return `${join(publicConfig.BASE_PATH, "/api/file/compressAndDownload")}?${pathParams}&cluster=${cluster}&download=${download}`;
};


export const urlToDownload = (cluster: string, path: string, download: boolean): string => {

  return join(publicConfig.BASE_PATH, "/api/file/download")
  + `?path=${encodeURIComponent(path)}&cluster=${cluster}&download=${download}`;
};
export const urlToUpload = (cluster: string, path: string, chunk?: boolean, originPath?: string): string => {

  return join(publicConfig.BASE_PATH, "/api/file/upload")
  + `?path=${encodeURIComponent(path)}&cluster=${cluster}&chunk=${chunk}&originPath=${originPath}`;
};

