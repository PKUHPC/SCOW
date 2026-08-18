import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ServiceError, status } from "@grpc/grpc-js";
import { SchedulerAdapterClient } from "@scow/lib-scheduler-adapter";
import { OptionalFeatures } from "@scow/scheduler-adapter-protos/build/config";
import { Logger } from "ts-log";

/**
 * 判断当前集群下调度器适配器是否包含可选功能
 */
export async function listSchedulerAdapterOptionalFeatures(
  client: SchedulerAdapterClient,
  logger: Logger,
): Promise<OptionalFeatures[]> {
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
    }
  }
  return optionalFeatures;
}
