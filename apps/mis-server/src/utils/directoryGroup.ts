import { ServiceError } from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { MisConfigSchema } from "@scow/config/build/mis";
import { MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
import { Logger } from "pino";
import { misConfig } from "src/config/mis";
import { createGroupService } from "src/directoryService/groupService";
import { IGroupService } from "src/directoryService/groupService/interface";
import { AccountGroupInitStatus, SystemState } from "src/entities/SystemState";

/** LDAP 批量查询或用户组写操作的最大并发数。 */
export const LDAP_GROUP_OPERATION_BATCH_SIZE = 50;

/**
 * 查询账户用户组是否已初始化，若已初始化则返回 IGroupService 实例，否则返回 null。
 */
export async function getGroupService(
  em: SqlEntityManager<MySqlDriver>,
  logger: Logger,
): Promise<IGroupService | null> {
  const accountGroupInitialized = await em.findOne(SystemState, {
    key: SystemState.KEYS.ACCOUNT_GROUP_INITIALIZED,
  });
  return accountGroupInitialized?.value === AccountGroupInitStatus.INITIALIZED
    ? createGroupService(misConfig.directoryService, logger)
    : null;
}

/**
 * 按 groupStrategy 获取用户的默认组 GID（即未开启账户存储配额时所在的组）。
 */
export async function getDefaultGroupGid(
  groupService: IGroupService,
  userId: string,
  misConfig: MisConfigSchema,
): Promise<number | undefined> {
  const groupStrategy = misConfig.directoryService?.ldap.addUser.groupStrategy;
  if (groupStrategy === "newGroupPerUser") {
    return await groupService.getGroupGid(userId);
  } else if (groupStrategy === "oneGroupForAllUsers") {
    return misConfig.directoryService?.ldap.addUser.oneGroupForAllUsers?.gidNumber;
  }
  return undefined;
}

/**
 * 校验已存在的账户组是否可作为同一 owner 上次创建失败后的残留状态继续使用。
 * 注意：目录服务的组没有 SCOW 账户 owner 语义。本函数只能确认本次请求指定的 ownerId
 * 是否已经属于目标账户组，不能证明该用户是这个目录组的“拥有者”，也不能证明该组由
 * 上一次同 owner 的创建请求生成。
 *
 * 当前没有持久化的回滚失败状态，且目录服务接口无法枚举组内全部成员，因此即使关系校验
 * 通过，也不能排除组内存在其他历史成员。无法确认用户与组的关系时必须拒绝自动复用，
 * 由管理员检查并清理目录组及历史文件属组，避免把新账户绑定到无关的既有目录组。
 */
export async function ensureExistingAccountGroupBelongsToOwner(
  groupService: IGroupService,
  accountName: string,
  accountGroupName: string,
  ownerId: string,
  logger: Logger,
): Promise<void> {
  const [ownerGroups, ownerPrimaryGroup] = await Promise.all([
    groupService.listUserGroups(ownerId),
    groupService.getUserPrimaryGroup(ownerId),
  ]);
  const ownerIsMember = ownerGroups.some(({ name }) => name === accountGroupName);
  const ownerBelongsToGroup = ownerPrimaryGroup === accountGroupName || ownerIsMember;

  if (ownerBelongsToGroup) {
    logger.warn(
      {
        accountName,
        accountGroupName,
        ownerId,
        ownerIsMember,
        ownerPrimaryGroup,
        recoveryDecision: "reuse",
      },
      "Reusing an existing directory group associated with the requested account owner",
    );
    return;
  }

  logger.error(
    {
      accountName,
      accountGroupName,
      requestedOwnerId: ownerId,
      ownerIsMember,
      ownerPrimaryGroup,
      recoveryDecision: "reject",
    },
    "Existing account directory group cannot be associated with the requested owner; manual recovery is required",
  );
  throw {
    code: Status.ALREADY_EXISTS,
    message: `Directory group ${accountGroupName} already exists, but user ${ownerId} is not associated with it. `
      + "The directory relationship cannot prove ownership or that the group is a failed creation residue. "
      + "An administrator must verify and manually restore the user and file group "
      + "before retrying.",
    details: "DIRECTORY_GROUP_ALREADY_EXISTS",
  } as ServiceError;
}

/**
 * 账户配额模式下，在用户加入账户前校验 LDAP 组关系。
 * 该函数只读：默认组和目标账户组可以共存，出现其他组时在任何外部写操作前拒绝，
 * 避免 SCOW 尚无账户关系、LDAP 却残留旧账户组时把用户加入第二个账户。
 */
export async function validateUserAccountGroupBeforeJoin(
  groupService: IGroupService,
  userId: string,
  targetAccountGroupName: string,
  misConfig: MisConfigSchema,
  logger: Logger,
): Promise<{ groups: { name: string; gid: number | undefined }[]; primaryGroup: string | undefined }> {
  const groupStrategy = misConfig.directoryService?.ldap.addUser.groupStrategy;
  let defaultGroupName: string;

  if (groupStrategy === "newGroupPerUser") {
    defaultGroupName = userId;
  } else if (groupStrategy === "oneGroupForAllUsers") {
    const defaultGroupGid = misConfig.directoryService?.ldap.addUser.oneGroupForAllUsers?.gidNumber;
    if (defaultGroupGid === undefined) {
      throw {
        code: Status.INTERNAL,
        message: "Cannot validate LDAP account groups: default group GID is not configured.",
      } as ServiceError;
    }
    const resolvedDefaultGroupName = await groupService.getGroupNameByGid(defaultGroupGid);
    if (!resolvedDefaultGroupName) {
      throw {
        code: Status.INTERNAL,
        message: `Cannot validate LDAP account groups: default group with GID ${defaultGroupGid} is not found.`,
      } as ServiceError;
    }
    defaultGroupName = resolvedDefaultGroupName;
  } else {
    throw {
      code: Status.INTERNAL,
      message: `Cannot validate LDAP account groups: unsupported groupStrategy ${groupStrategy}.`,
    } as ServiceError;
  }

  const [userGroups, userPrimaryGroup] = await Promise.all([
    groupService.listUserGroups(userId),
    groupService.getUserPrimaryGroup(userId),
  ]);
  const currentGroupNames = new Set(userGroups.map(({ name }) => name));
  if (userPrimaryGroup) currentGroupNames.add(userPrimaryGroup);

  const conflictingGroupNames = [...currentGroupNames].filter(
    (groupName) => groupName !== defaultGroupName && groupName !== targetAccountGroupName,
  );
  if (conflictingGroupNames.length === 0) return { groups: userGroups, primaryGroup: userPrimaryGroup };

  logger.warn(
    { userId, targetAccountGroupName, defaultGroupName, conflictingGroupNames },
    "User has conflicting LDAP groups and cannot be added to the target account",
  );
  throw {
    code: Status.FAILED_PRECONDITION,
    message: `User ${userId} belongs to LDAP group(s) ${conflictingGroupNames.join(", ")} and cannot be added `
      + `to account group ${targetAccountGroupName}. An administrator must resolve the group conflict first.`,
    details: `USER_LDAP_ACCOUNT_GROUP_CONFLICT:${conflictingGroupNames.join(",")}`,
  } as ServiceError;
}

/**
 * 若用户的主组与待移除的账户组相同，按 groupStrategy 将主组回退到合适的组。
 * 配置错误或 LDAP 操作失败时抛出 ServiceError。
 */
export async function resetPrimaryGroupIfNeeded(
  groupService: IGroupService,
  userId: string,
  accountGroupName: string,
  misConfig: MisConfigSchema,
): Promise<void> {
  const userPrimaryGroup = await groupService.getUserPrimaryGroup(userId).catch(() => undefined);
  if (userPrimaryGroup !== accountGroupName) return;

  const groupStrategy = misConfig.directoryService?.ldap.addUser.groupStrategy;

  if (groupStrategy === "newGroupPerUser") {
    await groupService.setUserPrimaryGroup(userId, userId);
  } else if (groupStrategy === "oneGroupForAllUsers") {
    const fallbackGid = misConfig.directoryService?.ldap.addUser.oneGroupForAllUsers?.gidNumber;
    if (fallbackGid === undefined) {
      throw {
        code: Status.INTERNAL,
        message: `Cannot reset primary group for user ${userId}: `
          + "groupStrategy is oneGroupForAllUsers but gidNumber is not configured.",
      } as ServiceError;
    }
    await groupService.setUserPrimaryGroupByGidNumber(userId, fallbackGid);
  } else {
    throw {
      code: Status.INTERNAL,
      message: `Cannot reset primary group for user ${userId}: `
        + `groupStrategy is not configured or unknown (value: ${groupStrategy}).`,
    } as ServiceError;
  }
}
