import { join } from "path";
import { Encoding } from "src/models/exportFile";
import { publicConfig } from "src/utils/config";

// 文件允许的最大导出行数
export const MAX_EXPORT_COUNT = 10000;

export const urlToExport = ({
  exportApi,
  columns,
  count,
  query,
  encoding,
  timeZone,
}: {
  exportApi: string
  columns: string[],
  count: number,
  query: Record<string, string | number | boolean | string[] | undefined>
  encoding: Encoding
  timeZone: string | undefined
},
) => {
  const params = new URLSearchParams();
  columns.forEach((column) => {
    params.append("columns", column);
  });

  Object.keys(query).forEach((key) => {
    const value = query[key];
    if (value !== undefined) {
      if (Array.isArray(value)) {
        if (value.length > 0) {
          value.forEach((item) => {
            params.append(key, item != null ? item.toString() : "");
          });
        } else {
          params.append(key, "");
        }
      } else {
        params.append(key, value != null ? value.toString() : "");
      }
    }
  });
  params.append("count", count.toString());
  params.append("encoding", encoding);
  params.append("timeZone",timeZone ?? "UTC");
  const queryString = params.toString();
  const fullPath = join(publicConfig.BASE_PATH, `/api/file/${exportApi}?${queryString}`);
  return fullPath;
};

