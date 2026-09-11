import { MisConfigSchema } from "@scow/config/build/mis";
import { Logger } from "pino";
import { IGroupService } from "src/directoryService/groupService/interface";
import { LdapGroupService } from "src/directoryService/groupService/ldap";
import { ServiceError, status } from "@grpc/grpc-js";

export type { IGroupService };

/**
 * 根据 mis 配置的 directoryService 创建 IGroupService 实例。
 * 当前实现为 LDAP，未来可根据 type 字段切换为 FreeIPA、AD 等其他实现。
 */
export function createGroupService(
  directoryService: MisConfigSchema["directoryService"],
  logger: Logger,
): IGroupService {
  if (!directoryService) {
    throw {
      code: status.FAILED_PRECONDITION,
      message: `directoryService is not configured in mis.yaml`,
      details: "DIRECTORY_SERVICE_NOT_CONFIGURED",
    } as ServiceError;
  }
  return new LdapGroupService(directoryService.ldap, logger);
}
