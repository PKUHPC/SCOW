import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ServiceError, status } from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { SchedulerAdapterClient } from "@scow/lib-scheduler-adapter";
import { OptionalFeatures } from "@scow/scheduler-adapter-protos/build/config";
import { Logger } from "ts-log";

/**
 * 判断当前集群下调度器适配器是否包含可选功能
 */
export async function listSchedulerAdapterOptionalFeatures(client: SchedulerAdapterClient, logger: Logger):
  Promise<OptionalFeatures[]> {

  const optionalFeatures: OptionalFeatures[] = [];
  try {
    const reply = await asyncClientCall(client.config, "listImplementedOptionalFeatures", {});
    optionalFeatures.push(...reply.features);
  } catch (e) {
    const ex = e as ServiceError;
    if (ex.code === status.UNIMPLEMENTED) {
      logger.info("The current adapter has not implemented any optional features.");
    } else {
      throw e;
    };
  }
  return optionalFeatures;
};


// 检查当前适配器是否可以使用 资源管理 的可选功能接口
export async function ensureResourceManagementFeatureAvailable(
  client: SchedulerAdapterClient,
  logger: Logger): Promise<void> {

  const optionalFeatures = await listSchedulerAdapterOptionalFeatures(client, logger);

  if (!optionalFeatures.includes(OptionalFeatures.RESOURCE_MANAGEMENT)) {
    throw {
      code: Status.FAILED_PRECONDITION,
      message: "precondition failed",
      details: "Resource management feature is not available in the current adapter version",
    } as ServiceError;
  }
}


