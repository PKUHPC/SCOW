import { ServiceError } from "@ddadaal/tsgrpc-common";
import { Logger } from "@ddadaal/tsgrpc-server";
import { status } from "@grpc/grpc-js";
import { StorageFsType } from "@scow/config/build/storage";
import { ServerStorageConfig } from "@scow/lib-server";
import { scowErrorMetadata } from "@scow/lib-server/build/error";
import { misConfig } from "src/config/mis";
import { createGroupService } from "src/directoryService/groupService";

/**
 * 预处理 LDAP 组名
 *
 * `groupNames` 与输入数组顺序和长度一致。对于需要 gid 转换的文件系统，
 * 当前仅包括 nfs, lfs, gpfs,
 * 纯数字 LDAP组名所在位置保存对应的 gidNumber 字符串；非纯数字组名始终保持原值。
 *
 * `groupNameMap` 包含每一个输入组名。key 是 SCOW 数据库中保存的原始 LDAP 组名，
 * value 是非 OceanStor Pacific 文件系统调用 scowd 时应使用的名称：纯数字组名对应
 * gidNumber 字符串，非纯数字组名对应其自身。如果本批次只有 OceanStor Pacific，
 * 所有 value 都与 key 相同，不包含由 LDAP 查询得到的 gidNumber。
 */
export interface ResolvedScowdQuotaGroupNames {
  groupNames: string[];
  groupNameMap: Map<string, string>;
}

/**
 * 本次 scowd 配额操作涉及的存储上下文。
 * `fs.type` 为 OceanStor Pacific 时，调用始终使用原始 LDAP 组名，不参与数字组名转换。
 */
export type ScowdQuotaStorageResolutionContext = Pick<ServerStorageConfig, "fs"> & {
  storageId?: string;
  clusterId?: string;
};

export const NUMERIC_GROUP_NAME_RESOLUTION_FAILED = "NumericGroupNameResolutionFailed";

class NumericGroupNameResolutionError extends Error {
  constructor(
    readonly groupName: string,
    readonly cause: unknown,
  ) {
    super(cause instanceof Error ? cause.message : String(cause));
  }
}

export const isNumericScowdQuotaGroupName = (groupName: string): boolean => /^\d+$/.test(groupName);

export const isNumericGroupNameResolutionError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "details" in error &&
  typeof error.details === "string" &&
  error.details.startsWith(NUMERIC_GROUP_NAME_RESOLUTION_FAILED);

export const createIdentityScowdQuotaGroupNameMap = (groupNames: string[]): Map<string, string> =>
  new Map(groupNames.map((groupName) => [groupName, groupName]));

/**
 * 将纯数字 LDAP 组名转换为 scowd 可用于非 OceanStor Pacific 组配额操作的 gidNumber。
 * OceanStor Pacific 不参与纯数字组名转换，也不会触发 LDAP gid 查询。
 *
 * 输入的 `groupNames` 始终是 SCOW 数据库中保存的原始 LDAP 组名，而不是 gid。
 * 原始组名可能恰好只包含数字；当前 scowd 在 NFS、Lustre、GPFS 上无法正确处理这种
 * 名称，因此需要从 LDAP 查询该组真正的 gidNumber，并将 gidNumber 转成字符串使用。
 * 非纯数字组名不会查询 LDAP，也不会转换为 gid。
 *
 * @param groupNames 本次操作涉及的全部原始 LDAP 组名，可包含纯数字和非纯数字组名。
 * @param logger 用于记录纯数字组名批量 gid 转换结果或失败信息。
 * @returns 覆盖全部输入组名的转换结果和映射；非纯数字组名保持原值。
 * @throws 任一纯数字组名无法解析 gid 时，整批转换失败。
 */
async function resolveNumericScowdQuotaGroupNames(
  groupNames: string[],
  storages: ScowdQuotaStorageResolutionContext[],
  logger: Logger,
): Promise<ResolvedScowdQuotaGroupNames> {
  const numericGroupNames = [...new Set(groupNames.filter(isNumericScowdQuotaGroupName))];
  if (numericGroupNames.length === 0) {
    return { groupNames, groupNameMap: createIdentityScowdQuotaGroupNameMap(groupNames) };
  }

  const groupService = createGroupService(misConfig.directoryService, logger);
  const changes = await Promise.all(
    numericGroupNames.map(async (groupName) => {
      try {
        const gid = await groupService.getGroupGid(groupName);
        if (gid === undefined) {
          throw new Error(`Numeric LDAP group '${groupName}' was not found or has no gidNumber`);
        }
        return { originalGroupName: groupName, gid, scowdGroupName: String(gid) };
      } catch (error) {
        throw new NumericGroupNameResolutionError(groupName, error);
      }
    }),
  ).catch((error: unknown) => {
    const failedGroupName = error instanceof NumericGroupNameResolutionError ? error.groupName : undefined;
    const cause = error instanceof NumericGroupNameResolutionError ? error.cause : error;
    logger.warn(
      {
        numericGroupNames,
        failedGroupNames: numericGroupNames,
        failedGroupName,
        storages: storages.map(({ storageId, clusterId, fs }) => ({ storageId, clusterId, fsType: fs.type })),
        err: cause,
      },
      "Failed to resolve numeric LDAP group names to gids for storage quota operation",
    );
    throw new ServiceError({
      code: status.FAILED_PRECONDITION,
      details: `${NUMERIC_GROUP_NAME_RESOLUTION_FAILED}: ${numericGroupNames.join(", ")}`,
      metadata: scowErrorMetadata(NUMERIC_GROUP_NAME_RESOLUTION_FAILED, {
        ...(failedGroupName ? { failedGroupName } : {}),
        failedGroupNames: numericGroupNames.join(","),
      }),
    });
  });
  const changedGroupNameMap = new Map(
    changes.map(({ originalGroupName, scowdGroupName }) => [originalGroupName, scowdGroupName]),
  );
  const groupNameMap = new Map(
    groupNames.map((groupName) => [groupName, changedGroupNameMap.get(groupName) ?? groupName]),
  );

  // 批量请求中的全部转换统一记录在一条日志中，便于追踪实际传给 scowd 的 groupNames。
  logger.debug(
    { groupNameChanges: changes },
    "Converted numeric LDAP group names to gids for scowd storage quota request",
  );

  return { groupNames: groupNames.map((groupName) => groupNameMap.get(groupName)!), groupNameMap };
}

/**
 * 根据本次配额操作涉及的文件系统，预处理账户组名。
 *
 * 只要 `storages` 中包含 NFS、Lustre 或 GPFS，就在调用任何 scowd 接口前解析整批
 * 纯数字组名。这样解析失败仍发生在原有业务预处理阶段，不会产生部分存储已调用、
 * 另一部分尚未调用的状态。
 *
 * 如果 `storages` 为空或全部为 OceanStor Pacific，则不会访问 LDAP，返回的名称全部
 * 为原始 LDAP 组名；这类结果中一定没有本函数查询产生的 gidNumber。
 *
 * @param groupNames SCOW 数据库中保存的原始 LDAP 组名，不应传入已转换的 gidNumber
 * @param storages 本次业务即将调用的全部存储；判断依据是每项的 `fs.type`。
 * OceanStor Pacific 仅保留原始组名，不参与纯数字组名到 gid 的转换；
 * 只有 NFS、Lustre 或 GPFS 会触发 LDAP 解析。
 * @param logger 传递给 LDAP 组名解析过程的服务日志
 * @returns 覆盖所有输入组名的预处理结果；非纯数字组名始终映射到自身
 */
export async function resolveScowdQuotaGroupNames(
  groupNames: string[],
  storages: ScowdQuotaStorageResolutionContext[],
  logger: Logger,
): Promise<ResolvedScowdQuotaGroupNames> {
  const requiresGidResolution = storages.some((storage) =>
    [StorageFsType.nfs, StorageFsType.lfs, StorageFsType.gpfs].includes(storage.fs.type),
  );
  if (!requiresGidResolution) {
    return { groupNames, groupNameMap: createIdentityScowdQuotaGroupNameMap(groupNames) };
  }

  return resolveNumericScowdQuotaGroupNames(groupNames, storages, logger);
}

/**
 * 批量尽力处理组名：LDAP 批次失败时排除所有需要转换的纯数字组，非数字组继续执行。
 * 解析函数对数字组仍保持整批 Promise.all 语义，不把 LDAP 转换降级为逐项尽力而为。
 * 如果本批次仅包含 OceanStor Pacific，则不会查询 LDAP，所有组名都会原样保留。
 */
export async function resolveScowdQuotaGroupNamesBestEffort<T>(
  items: T[],
  getGroupName: (item: T) => string,
  storages: ScowdQuotaStorageResolutionContext[],
  logger: Logger,
): Promise<{ items: T[]; failedItems: T[]; groupNameMap: Map<string, string> }> {
  const groupNames = items.map(getGroupName);
  try {
    const { groupNameMap } = await resolveScowdQuotaGroupNames(groupNames, storages, logger);
    return { items, failedItems: [], groupNameMap };
  } catch (error) {
    if (!isNumericGroupNameResolutionError(error)) throw error;

    const failedItems = items.filter((item) => isNumericScowdQuotaGroupName(getGroupName(item)));
    const remainingItems = items.filter((item) => !isNumericScowdQuotaGroupName(getGroupName(item)));
    return {
      items: remainingItems,
      failedItems,
      groupNameMap: createIdentityScowdQuotaGroupNameMap(remainingItems.map(getGroupName)),
    };
  }
}

/**
 * 获取某个具体文件系统调用 scowd 时使用的组名。
 *
 * OceanStor Pacific 始终返回原始 LDAP `groupName`，即使它是纯数字；NFS、Lustre、
 * GPFS 返回预处理映射中的值。对于非纯数字组名，映射值一定仍是原始组名；只有原始
 * 组名为纯数字且本批次包含上述三类文件系统时，映射值才可能是 gidNumber 字符串。
 *
 * @param groupName SCOW 数据库中保存的原始 LDAP 组名
 * @param storage 当前即将调用 scowd 的具体存储，用 `fs.type` 决定使用原始值还是预处理值
 * @param resolvedGroupNameMap 同一批 `resolveScowdQuotaGroupNames` 返回的完整映射
 * @returns 当前文件系统应传给 scowd 的 groupName。OceanStor Pacific 始终返回原始组名，
 * 不使用数字组名转换得到的 gid。
 */
export function getScowdQuotaGroupNameForStorage(
  groupName: string,
  storage: Pick<ServerStorageConfig, "fs">,
  resolvedGroupNameMap: Map<string, string>,
): string {
  return storage.fs.type === StorageFsType.oceanStorPacific ? groupName : resolvedGroupNameMap.get(groupName)!;
}
