import { TRPCError } from "@trpc/server";
import { TRPC_ERROR_CODE_KEY } from "@trpc/server/rpc";

// 自定义的消息详细
// type: 用于前端识别自定义错误分类
// 其他参数: 用于前端显示等进一步处理
export type DetailedError =
  | { type: "account_user_not_available"; userId: string; accountName: string }
  | {
      type: "cluster_partition_not_available";
      clusterId: string;
      accountName: string;
      partitionName: string | undefined;
    }
  | { type: "app_not_available"; appId: string | undefined; accountName: string }
  | { type: "path_validation_failed"; message: string }
  | { type: "image_address_validation_failed"; message: string };

// 包含详细信息的自定义TRPCError
export class DetailedTRPCError extends TRPCError {
  public readonly detail: DetailedError;
  constructor({
    code,
    message,
    detail,
    cause,
  }: {
    code: TRPC_ERROR_CODE_KEY;
    message?: string;
    detail: DetailedError;
    cause?: unknown;
  }) {
    super({
      code,
      message: message || "An error occurred",
      cause,
    });

    this.detail = detail;
  }
}
