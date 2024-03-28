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

// 文件允许的最大导出行数
export const MAX_EXPORT_COUNT = 10000;

export const urlToExport = ({
  exportApi,
  columns,
  count,
  query,
}: {
    exportApi: string
    columns: string[],
    count: number,
    query: {[key: string]: string | number | boolean | string[] | undefined}
  },
) => {
  const exportQuery = `${exportApi}?${
    columns.map((column) => `columns=${column}`).join("&")
  }&${
    Object.keys(query)
      .filter((key) => query[key] !== undefined)
      .map((key) => {
        if (Array.isArray(query[key])) {
          return (query[key] as string[]).map((value) => `${key}=${encodeURIComponent(value)}`).join("&");
        }

        const value = query[key] as string | number | boolean;
        return `${key}=${encodeURIComponent(value)}`;
      }).join("&")
  }&count=${count}`;

  return join(publicConfig.BASE_PATH, `/api/file/${exportQuery}`);
};

