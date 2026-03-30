import { TRPCError } from "@trpc/server";
import { dirname } from "path";
import { clusters } from "src/server/config/clusters";

/**
 * 计算共享目录顶层路径：
 * 1) 优先使用集群级 `sharedTopDir` 配置；
 * 2) 未配置时按用户家目录回退到“上上级目录”（如 `/nfs/home/user` -> `/nfs`）；
 * 3) 若上上级退化为根目录 `/`，则回退为上级目录，避免共享目录挂到根路径。
 */
export const buildSharedTopDir = (clusterId: string, homeDir: string): string => {
  const cluster = clusters[clusterId];
  if (!cluster) {
    throw new TRPCError({ code: "NOT_FOUND", message: "cluster is not found" });
  }

  // 集群显式配置优先。
  if (cluster.ai.sharedTopDir) {
    return cluster.ai.sharedTopDir;
  }

  // 默认取家目录上上级作为共享顶层。
  const homeParentDir = dirname(homeDir);
  const homeTopDir = dirname(homeParentDir);

  // 防止回退结果为根目录 "/"。
  return homeTopDir === "/" ? homeParentDir : homeTopDir;
};
