import { plugin } from "@ddadaal/tsgrpc-server";
import { ServiceError, status } from "@grpc/grpc-js";
import { AppConfigSchema } from "@scow/config/build/app";
import { DashboardServiceServer, DashboardServiceService, Entry } from "@scow/protos/build/portal/dashboard";
import { promises as fsPromises } from "fs";
import path from "path";
import { getClusterAppConfigs } from "src/utils/app";

const quickEntryPath = "/var/lib/scow/portal/quickEntries";

// 在线集群单独处理
export const dashboardServiceServer = plugin((server) => {
  return server.addService<DashboardServiceServer>(DashboardServiceService, {
    getQuickEntries: async ({ request, logger }) => {
      const { userId } = request;
      const filePath = path.join(quickEntryPath, userId, "quickEntries.json");

      // 读取 JSON 文件
      let jsonObject!: Entry[];
      try {
        // 同步读取 JSON 文件
        const data = await fsPromises.readFile(filePath, "utf8");
        // 将 JSON 字符串解析为 JavaScript 对象
        jsonObject = JSON.parse(data);
      } catch (error) {
        // 如果文件不存在则返回空数组
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return [{ quickEntries: [] }];
        }

        // 其他错误则抛错
        logger.info("Read file failed with %o", error);
        throw {
          code: status.INTERNAL,
          message: `read file ${userId}'s quickEntries.json failed`,
        } as ServiceError;
      }

      // 缓存集群应用配置
      const clusterAppConfigsCache = new Map<string, Record<string, AppConfigSchema>>();
      const getCachedClusterAppConfigs = (clusterId: string): Record<string, AppConfigSchema> | undefined => {
        if (!clusterAppConfigsCache.has(clusterId)) {
          clusterAppConfigsCache.set(clusterId, getClusterAppConfigs(clusterId));
        }
        return clusterAppConfigsCache.get(clusterId);
      };

      // 在返回的appEntry中添加appLogoPath,
      // 使前端无论是否还有对应应用的授权仍然可以显示保存的快捷方式的logo（如果存在logo图片）
      const mappedEntries = jsonObject.map((entry) => {
        if (entry.entry?.$case === "app") {
          const { appId, clusterId } = entry.entry.app;
          const clusterApps = getCachedClusterAppConfigs(clusterId);
          const currentLogoPath = clusterApps?.[appId]?.logoPath || undefined;
          return {
            ...entry,
            entry: {
              ...entry.entry,
              app: {
                ...entry.entry.app,
                appLogoPath: currentLogoPath,
              },
            },
          };
        }
        return entry;
      });

      return [
        {
          quickEntries: mappedEntries,
        },
      ];
    },
    saveQuickEntries: async ({ request, logger }) => {
      const { userId, quickEntries } = request;
      const jsonContent = JSON.stringify(quickEntries);
      const filePath = path.join(quickEntryPath, userId, "quickEntries.json");

      // 获取文件的目录路径
      const dirPath = path.dirname(filePath);

      try {
        // 检查目录是否存在，如果不存在则创建目录
        await fsPromises.mkdir(dirPath, { recursive: true });

        // 将内容写入文件
        await fsPromises.writeFile(filePath, jsonContent);

        return [{}];
      } catch (err) {
        const errorMessage =
          err instanceof Error && "message" in err ? `Error saving quick entry for user ${userId}: ${err.message}` : "";

        logger.info("Saving file failed with %o", err);
        throw {
          code: status.INTERNAL,
          message: errorMessage || `An error occurred while saving quick entry for user ${userId}`,
        } as ServiceError;
      }
    },
  });
});
