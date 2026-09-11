import { Code, ConnectError } from "@connectrpc/connect";
import { ServiceError } from "@ddadaal/tsgrpc-common";
import { Logger } from "@ddadaal/tsgrpc-server";
import { status } from "@grpc/grpc-js";
import { Loaded } from "@mikro-orm/core";
import { MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
import { getClusterConfigs, StorageEntrySchema } from "@scow/config/build/cluster";
import { MisConfigSchema } from "@scow/config/build/mis";
import { getServerStorageConfig } from "@scow/config/build/storage";
import {
  buildStorageConfigProto,
  getClusterQuotaStorageConfigs,
  getExecutableStorageIds,
  ServerStorageConfig,
} from "@scow/lib-server";
import { expandTemplatePath, normPath } from "@scow/utils";
import { getActivatedClusters } from "src/bl/clustersUtils";
import { configClusters } from "src/config/clusters";
import { IGroupService } from "src/directoryService/groupService/interface";
import { Account, AccountState } from "src/entities/Account";
import { AccountStorageQuota } from "src/entities/AccountStorageQuota";
import { SystemState } from "src/entities/SystemState";
import { TenantStorageQuota } from "src/entities/TenantStorageQuota";
import { TenantUserStorageQuota } from "src/entities/TenantUserStorageQuota";
import { User, UserState } from "src/entities/User";
import { UserAccount } from "src/entities/UserAccount";
import { getAccountGroupName } from "src/utils/account";
import {
  ensureExistingAccountGroupBelongsToOwner,
  getDefaultGroupGid,
  LDAP_GROUP_OPERATION_BATCH_SIZE,
} from "src/utils/directoryGroup";
import {
  executeStorageOperationWithFailover,
  resolveStorageExecutionTarget,
} from "src/utils/storageExecutionTarget";

import { getScowdClient } from "./scowd";
import { getScowdQuotaGroupNameForStorage, resolveScowdQuotaGroupNames } from "./scowdQuotaGroupName";
import { buildStorageQuotaExecutionFields } from "./storageQuotaRecord";

export const ACCOUNT_QUOTA_STATE = {
  DISABLED: "disabled",
  ENABLING: "enabling",
  ENABLED: "enabled",
} as const;

export interface ImportedUserAccountRelation {
  userId: string;
  accountName: string;
}

/** 校验导入关系与数据库现有有效关系合并后是否仍满足单账户模式。 */
export async function validateImportedUserAccountRelations(
  em: SqlEntityManager<MySqlDriver>,
  importedRelations: ImportedUserAccountRelation[],
): Promise<void> {
  const importedAccountsByUser = new Map<string, Set<string>>();
  for (const relation of importedRelations) {
    const accounts = importedAccountsByUser.get(relation.userId) ?? new Set<string>();
    accounts.add(relation.accountName);
    importedAccountsByUser.set(relation.userId, accounts);
  }

  const userIds = [...importedAccountsByUser.keys()];
  const existingRelations =
    userIds.length === 0
      ? []
      : await em.find(
          UserAccount,
          {
            user: { userId: { $in: userIds }, state: { $ne: UserState.DELETED } },
            account: { state: { $ne: AccountState.DELETED } },
          },
          { populate: ["user", "account"] },
        );

  const existingAccountsByUser = new Map<string, Set<string>>();
  for (const relation of existingRelations) {
    const userId = relation.user.$.userId;
    const accounts = existingAccountsByUser.get(userId) ?? new Set<string>();
    accounts.add(relation.account.$.accountName);
    existingAccountsByUser.set(userId, accounts);
  }

  const violatingUserIds = userIds.filter((userId) => {
    const accounts = new Set([
      ...(importedAccountsByUser.get(userId) ?? []),
      ...(existingAccountsByUser.get(userId) ?? []),
    ]);
    return accounts.size > 1;
  });

  if (violatingUserIds.length > 0) {
    throw new ServiceError({
      code: status.FAILED_PRECONDITION,
      message: `The following users belong to multiple accounts: ${violatingUserIds.join(",")}`,
      details: `MULTI_ACCOUNT_USERS:${violatingUserIds.join(",")}`,
    });
  }
}

/** 检查并修正账户配额模式下用户已有的目录组。 */
export async function checkAndFixUserGroupsForAccountQuota(
  userIds: string[],
  groupService: IGroupService,
  misConfig: MisConfigSchema,
  cachedGroups?: Map<string, { name: string; gid: number | undefined }[]>,
): Promise<void> {
  const tooManyGroupUsers: string[] = [];
  const defaultGroupNotRemovedUsers: string[] = [];
  const groupStrategy = misConfig.directoryService?.ldap.addUser.groupStrategy;
  const fallbackGid = misConfig.directoryService?.ldap.addUser.oneGroupForAllUsers?.gidNumber;

  for (let i = 0; i < userIds.length; i += LDAP_GROUP_OPERATION_BATCH_SIZE) {
    const batch = userIds.slice(i, i + LDAP_GROUP_OPERATION_BATCH_SIZE);
    await Promise.all(
      batch.map(async (userId) => {
        const groups = cachedGroups?.get(userId) ?? await groupService.listUserGroups(userId);
        if (groups.length <= 1) return;

        if (groups.length > 2) {
          tooManyGroupUsers.push(userId);
          return;
        }

        let defaultGroupName: string | undefined;
        if (groupStrategy === "newGroupPerUser") {
          defaultGroupName = userId;
        } else if (groupStrategy === "oneGroupForAllUsers") {
          if (fallbackGid === undefined) {
            tooManyGroupUsers.push(userId);
            return;
          }
          defaultGroupName = groups.find((group) => group.gid === fallbackGid)?.name;
        }

        if (!defaultGroupName) {
          defaultGroupNotRemovedUsers.push(userId);
          return;
        }

        const accountGroupName = groups.find((group) => group.name !== defaultGroupName)?.name;
        if (!accountGroupName) return;

        await groupService.setUserPrimaryGroup(userId, accountGroupName);
        await groupService.removeUserFromGroup(userId, defaultGroupName);
      }),
    );
  }

  if (tooManyGroupUsers.length > 0) {
    throw new ServiceError({
      code: status.FAILED_PRECONDITION,
      message: `The following users belong to more than 2 groups: ${tooManyGroupUsers.join(",")}`,
      details: `MULTI_GROUP_USERS:${tooManyGroupUsers.join(",")}`,
    });
  }

  if (defaultGroupNotRemovedUsers.length > 0) {
    throw new ServiceError({
      code: status.FAILED_PRECONDITION,
      message: `The following users still have their default group: ${defaultGroupNotRemovedUsers.join(",")}`,
      details: `DEFAULT_GROUP_NOT_REMOVED:${defaultGroupNotRemovedUsers.join(",")}`,
    });
  }
}

/** 在导入数据落库前维护账户组关系；账户配额开启时再处理主组、文件属组和存储配额。 */
export async function prepareImportedRelationsForAccountQuota(
  em: SqlEntityManager<MySqlDriver>,
  relations: { account: Account; userId: string; ownerId: string }[],
  groupService: IGroupService,
  misConfig: MisConfigSchema,
  whitelistAll: boolean,
  logger: Logger,
  accountQuotaEnabled = true,
): Promise<void> {
  const accountQuotaCache: NewAccountGroupQuotaCache = {
    tenantQuotaMaps: new Map(),
    filesystemTotalQuotaMb: new Map(),
  };
  const accountRelations = new Map<
    string,
    {
      account: Account;
      users: { userId: string; ownerId: string }[];
    }
  >();
  const accountGroupNames = new Map<string, string>();
  for (const relation of relations) {
    const accountName = relation.account.accountName;
    const accountRelation = accountRelations.get(accountName) ?? {
      account: relation.account,
      users: [],
    };
    accountRelation.users.push({ userId: relation.userId, ownerId: relation.ownerId });
    accountRelations.set(accountName, accountRelation);
  }

  for (const { account, users } of accountRelations.values()) {
    const accountGroupName = account.accountGroupName ?? getAccountGroupName(account.accountName);
    accountGroupNames.set(account.accountName, accountGroupName);
    const groupExists = await groupService.checkGroupExists(accountGroupName);
    if (!groupExists) {
      await groupService.createGroup(accountGroupName);
    } else if (account.id === undefined) {
      // 目录服务没有 owner 语义：这里只能确认导入数据指定的 owner 已属于同名组，不能证明
      // 该用户拥有该组或该组来自前一次失败。关系不匹配时拒绝复用，交由管理员检查处理；
      // 关系匹配也无法排除组内存在其他历史成员。
      const ownerId = users[0]?.ownerId;
      if (!ownerId) {
        throw new ServiceError({
          code: status.FAILED_PRECONDITION,
          message: `Owner is required to recover existing directory group ${accountGroupName}`,
        });
      }
      await ensureExistingAccountGroupBelongsToOwner(
        groupService,
        account.accountName,
        accountGroupName,
        ownerId,
        logger,
      );
    }
    // 配额开启时，新导入账户需要收敛底层组配额；已有 SCOW 账户不覆盖自定义配额。
    if (accountQuotaEnabled && (!groupExists || account.id === undefined)) {
      const tenant = account.tenant.getEntity();
      const shouldUseBlockedQuota =
        !whitelistAll && (account.blockedInCluster || tenant.defaultAccountBlockThreshold.gte(0));
      await setNewAccountGroupStorageQuota(
        em,
        tenant.name,
        accountGroupName,
        shouldUseBlockedQuota ? BLOCKED_ACCOUNT_QUOTA_MB : undefined,
        accountQuotaCache,
        logger,
      );
    }

    for (const { userId, ownerId } of users) {
      await groupService.addUserToGroup(userId, accountGroupName);
      if (accountQuotaEnabled) {
        await switchUserToAccountGroup(
          groupService,
          em,
          userId,
          accountGroupName,
          ownerId,
          misConfig,
          logger,
          async (error) => {
            throw error;
          },
        );
      }
    }
  }

  // 所有外部目录及文件操作成功后才修改实体，避免中途查询触发 ORM auto-flush。
  for (const { account } of accountRelations.values()) {
    account.accountGroupName = accountGroupNames.get(account.accountName)!;
  }
}
export async function isAccountStorageQuotaEnabled(em: SqlEntityManager<MySqlDriver>) {
  const stateRecord = await em.findOne(SystemState, { key: SystemState.KEYS.ACCOUNT_STORAGE_QUOTA_STATE });
  return stateRecord?.value === ACCOUNT_QUOTA_STATE.ENABLED;
}

const BLOCKED_ACCOUNT_QUOTA_MB = BigInt(10);

async function getActivatedQuotaStorageIds(
  em: SqlEntityManager<MySqlDriver>,
  logger: Logger,
  operation: string,
) {
  const clusterConfigs = getClusterConfigs(undefined, logger);
  const activatedClusters = await getActivatedClusters(em, logger);
  const activatedClusterIds = new Set(Object.keys(activatedClusters));
  const storageIds = getExecutableStorageIds(clusterConfigs, activatedClusterIds);

  if (storageIds.length === 0) {
    const configuredQuotaStorageIds = Array.from(
      new Set(
        Object.values(clusterConfigs).flatMap((config) =>
          getClusterQuotaStorageConfigs(config).map((storage) => storage.storageId),
        ),
      ),
    );
    logger.info(
      { operation, activatedClusterIds: [...activatedClusterIds], configuredQuotaStorageIds },
      "No quota-enabled storage is mounted on an activated cluster; skipping storage quota operation",
    );
  }

  return storageIds;
}

/**
 * 为普通创建账户流程初始化账户组的底层存储配额。
 * 纯数字 LDAP 组名仅针对 NFS、Lustre、GPFS 转换为 gid；OceanStor Pacific 不参与该转换，
 * 始终使用原始账户组名调用 scowd。
 *
 * - 处理所有配置集群中启用 quota 且开启 scowd 的存储；多集群挂载同一 storageId 时只设置一次。
 * - 封锁账户使用封锁额度；解封账户优先使用租户账户默认额度，未配置时回退到文件系统总容量。
 * - 任一存储失败时将本次已经触达的组配额限制为封锁额度并抛出异常，防止创建失败的账户组继续占用资源。
 */
export async function initializeCreatedAccountGroupStorageQuota(
  accountName: string,
  accountGroupName: string,
  tenantName: string,
  blockedInCluster: boolean,
  em: SqlEntityManager<MySqlDriver>,
  logger: Logger,
): Promise<void> {
  const storageIds = await getActivatedQuotaStorageIds(em, logger, "initializeCreatedAccountGroupStorageQuota");
  if (storageIds.length === 0) return;

  const tenantAccountQuotaMap = blockedInCluster
    ? new Map<string, bigint | null>()
    : new Map(
        (await em.find(TenantStorageQuota, { tenant: { name: tenantName } })).map((quota) => [
          quota.storageId,
          quota.accountDefaultQuota,
        ]),
      );
  const filesystemTotalQuotaMb = new Map<string, bigint>();
  const clusterConfigs = getClusterConfigs(undefined, logger);
  const quotaStorages = storageIds.flatMap((storageId) =>
    Object.entries(clusterConfigs).flatMap(([clusterId, config]) =>
      getClusterQuotaStorageConfigs(config)
        .filter((storage) => storage.storageId === storageId)
        .map((storage) => ({ cluster: clusterId, storage })),
    ),
  );
  const { groupNameMap } = await resolveScowdQuotaGroupNames(
    [accountGroupName],
    quotaStorages.map(({ cluster, storage }) => ({ ...storage, clusterId: cluster })),
    logger,
  );
  const touchedQuotas: {
    cluster: string;
    storage: ServerStorageConfig;
    groupName: string;
  }[] = [];

  try {
    for (const storageId of storageIds) {
      await executeStorageOperationWithFailover(storageId, em, logger, async ({
        executionCluster: cluster,
        executionStorage: storage,
      }) => {
        const scowdClient = getScowdClient(cluster);
        const scowdAccountGroupName = getScowdQuotaGroupNameForStorage(accountGroupName, storage, groupNameMap);
        let totalQuotaMb = filesystemTotalQuotaMb.get(storageId);
        if (!blockedInCluster && tenantAccountQuotaMap.get(storageId) == null) {
          if (totalQuotaMb === undefined) {
            const usage = await scowdClient.storageQuota.getFilesystemStorageUsage({ path: storage.mountPath });
            totalQuotaMb = BigInt(usage.totalStorageMb);
            filesystemTotalQuotaMb.set(storageId, totalQuotaMb);
          }
        }

        const quotaMb = blockedInCluster
          ? BLOCKED_ACCOUNT_QUOTA_MB
          : (tenantAccountQuotaMap.get(storageId) ?? totalQuotaMb!);
        // 在调用前记录目标；即使请求报错，scowd 也可能已经完成写入，失败时仍需执行封锁补偿。
        touchedQuotas.push({
          cluster,
          storage,
          groupName: scowdAccountGroupName,
        });

        await scowdClient.storageQuota.setGroupStorageQuota({
          groupName: scowdAccountGroupName,
          path: storage.mountPath,
          quotaMb,
          storage: buildStorageConfigProto(storage),
        });
      });
    }
  } catch (error) {
    logger.error(
      { err: error, accountName, accountGroupName, blockedInCluster },
      "Failed to initialize storage quota for newly created account group; applying blocked quota compensation",
    );
    // 调用失败时无法确认 scowd 是否已落盘，因此失败的目标也按反向顺序设置封锁额度。
    for (const quota of touchedQuotas.reverse()) {
      try {
        await executeStorageOperationWithFailover(quota.storage.storageId, em, logger, (target) =>
          getScowdClient(target.executionCluster).storageQuota.setGroupStorageQuota({
            groupName: getScowdQuotaGroupNameForStorage(accountGroupName, target.executionStorage, groupNameMap),
            path: target.executionPath,
            quotaMb: BLOCKED_ACCOUNT_QUOTA_MB,
            storage: buildStorageConfigProto(target.executionStorage),
          }),
        );
      } catch (rollbackError) {
        logger.error(
          {
            err: rollbackError,
            accountName,
            accountGroupName,
            storageId: quota.storage.storageId,
            cluster: quota.cluster,
            mountPath: quota.storage.mountPath,
            compensationQuotaMb: BLOCKED_ACCOUNT_QUOTA_MB.toString(),
          },
          "Failed to apply blocked quota compensation for newly created account group",
        );
      }
    }
    throw error instanceof ServiceError
      ? error
      : new ServiceError({
          code: status.INTERNAL,
          message: `Storage quota initialization failed for account ${accountName}`,
        });
  }
}

/**
 * 设置新用户的存储配额
 * @param em
 * @param tenantName 新用户所属租户名
 * @param identityId 用户 id
 */
export async function setNewUserStorageQuota(
  em: SqlEntityManager<MySqlDriver>,
  tenantName: string,
  identityId: string,
  logger: Logger,
) {
  const storageIds = await getActivatedQuotaStorageIds(em, logger, "setNewUserStorageQuota");
  if (storageIds.length === 0) return;

  const tenantQuotas = await em.find(TenantStorageQuota, { tenant: { name: tenantName } });
  const tenantQuotaMap = new Map(tenantQuotas.map((quota) => [quota.storageId, quota.userDefaultQuota]));
  const user = await em.findOne(User, { userId: identityId });
  if (!user) {
    throw new ServiceError({
      code: status.INTERNAL,
      details: `User ${identityId} not found`,
    });
  }

  for (const storageId of storageIds) {
      // 若该用户在当前文件系统上已经有记录，则说明之前已经初始化过，
      const existingQuota = await em.findOne(TenantUserStorageQuota, {
        storageId,
        user: { userId: identityId },
      });
      if (existingQuota) {
        logger.debug(
          "Storage quota record already exists for user %s on storage %s, skipping",
          identityId,
          storageId,
        );
        continue;
      }

      const { executionCluster, executionPath } = await executeStorageOperationWithFailover(
        storageId,
        em,
        logger,
        async ({ executionCluster, executionPath, executionStorage }) => {
          const scowdClient = getScowdClient(executionCluster);
          // 默认额度依赖文件系统总量时，查询和设置必须在同一个候选挂载点完成。
          const quotaMb = tenantQuotaMap.get(storageId) ?? BigInt(
            (await scowdClient.storageQuota.getFilesystemStorageUsage({ path: executionPath })).totalStorageMb,
          );
          await scowdClient.storageQuota.setUserStorageQuota({
            userId: identityId,
            path: executionPath,
            quotaMb,
            storage: buildStorageConfigProto(executionStorage),
          });
        },
      );

      em.persist(new TenantUserStorageQuota({
        user,
        ...buildStorageQuotaExecutionFields(storageId, executionCluster, executionPath),
        usage: BigInt(0),
      }));
  }

  await em.flush();
}

interface NewAccountGroupQuotaCache {
  tenantQuotaMaps: Map<string, Promise<Map<string, bigint | null>>>;
  filesystemTotalQuotaMb: Map<string, bigint>;
}

/**
 * 为新建的账户组按租户账户默认值设置各存储的组配额。
 * OceanStor Pacific 不参与纯数字组名到 gid 的转换；其他需要转换的文件系统使用 LDAP gid。
 */
async function setNewAccountGroupStorageQuota(
  em: SqlEntityManager<MySqlDriver>,
  tenantName: string,
  accountGroupName: string,
  quotaOverrideMb: bigint | undefined,
  cache: NewAccountGroupQuotaCache,
  logger: Logger,
): Promise<void> {
  const storageIds = await getActivatedQuotaStorageIds(em, logger, "setNewAccountGroupStorageQuota");
  if (storageIds.length === 0) return;
  const clusterConfigs = getClusterConfigs(undefined, logger);
  const activatedClusters = await getActivatedClusters(em, logger);
  const activatedClusterIds = new Set(Object.keys(activatedClusters));
  const quotaStorages = storageIds.flatMap((storageId) =>
    Object.entries(clusterConfigs).flatMap(([clusterId, clusterConfig]) =>
      activatedClusterIds.has(clusterId)
        ? getClusterQuotaStorageConfigs(clusterConfig)
          .filter((storage) => storage.storageId === storageId)
          .map((storage) => ({ ...storage, clusterId }))
        : [],
    ),
  );
  const { groupNameMap } = await resolveScowdQuotaGroupNames([accountGroupName], quotaStorages, logger);
  let tenantAccountQuotaMap = new Map<string, bigint | null>();
  if (quotaOverrideMb === undefined) {
    let tenantQuotaMapPromise = cache.tenantQuotaMaps.get(tenantName);
    if (!tenantQuotaMapPromise) {
      tenantQuotaMapPromise = em
        .find(TenantStorageQuota, { tenant: { name: tenantName } })
        .then((tenantQuotas) => new Map(tenantQuotas.map((quota) => [quota.storageId, quota.accountDefaultQuota])));
      cache.tenantQuotaMaps.set(tenantName, tenantQuotaMapPromise);
    }
    tenantAccountQuotaMap = await tenantQuotaMapPromise;
  }
  for (const storageId of storageIds) {
    await executeStorageOperationWithFailover(storageId, em, logger, async ({
      executionCluster,
      executionPath,
      executionStorage,
    }) => {
      const scowdClient = getScowdClient(executionCluster);
      let quotaMb = quotaOverrideMb ?? tenantAccountQuotaMap.get(storageId);
      if (quotaMb === null || quotaMb === undefined) {
        quotaMb = cache.filesystemTotalQuotaMb.get(storageId);
        if (quotaMb === undefined) {
          quotaMb = BigInt(
            (await scowdClient.storageQuota.getFilesystemStorageUsage({ path: executionPath })).totalStorageMb,
          );
          cache.filesystemTotalQuotaMb.set(storageId, quotaMb);
        }
      }

      await scowdClient.storageQuota.setGroupStorageQuota({
        groupName: getScowdQuotaGroupNameForStorage(accountGroupName, executionStorage, groupNameMap),
        path: executionPath,
        quotaMb,
        storage: buildStorageConfigProto(executionStorage),
      });
      logger.info(
        "Set initial storage quota %s MB for new account group %s on storage %s",
        quotaMb,
        accountGroupName,
        storageId,
      );
    });
  }
}

/**
 * 修改单个集群内指定用户的家目录及存储路径的文件所属组。
 */
async function changeUserFileGroupForCluster(
  scowdClient: ReturnType<typeof getScowdClient>,
  entryPaths: StorageEntrySchema[] | undefined,
  userId: string,
  userUidNumber: number,
  targetGid: number,
  operatorId: string,
  clusterId: string,
  logger: Logger,
): Promise<void> {
  const serverStorageConfig = getServerStorageConfig();

  let homePath: string;
  try {
    ({ path: homePath } = await scowdClient.file.getHomeDirectory({ userId }));
  } catch (e) {
    if (e instanceof ConnectError && e.code === Code.NotFound) {
      logger.warn(`Home dir not found for user ${userId} on cluster ${clusterId}, skipping`);
      return;
    }
    throw e;
  }

  try {
    // 对于k8s集群允许对个人可信路径绕过权限校验
    // hpc中没有noCheckPermission参数，所以不需要判断集群
    await scowdClient.file.changeOwner({
      userId: operatorId,
      path: homePath,
      gid: targetGid,
      recursive: true,
      noCheckPermission: true,
    });
  } catch (e) {
    if (e instanceof ConnectError && e.code === Code.NotFound) {
      logger.warn(`Home dir ${homePath} not found for user ${userId} on cluster ${clusterId}, skipping`);
    } else {
      throw e;
    }
  }

  for (const entry of entryPaths ?? []) {
    const storageConf = serverStorageConfig.storages.find((s) => s.storageId === entry.storageId);
    if (!storageConf?.quotaEnabled) continue;

    const userPaths = (entry.paths ?? [])
      .filter((p) => p.pathTemplate.endsWith("/{{userId}}"))
      .map((p) => normPath(expandTemplatePath(p.pathTemplate, entry.mountPath, userId)));

    for (const userStoragePath of userPaths) {
      try {
        // 对于k8s集群允许对个人可信路径绕过权限校验
        // entryPaths的情况，每一个拿到的path就是可信个人目录且这个值是必须路径完全一致
        await scowdClient.file.changeOwner({
          userId: operatorId,
          path: userStoragePath,
          gid: targetGid,
          recursive: true,
          noCheckPermission: true,
        });
      } catch (e) {
        if (e instanceof ConnectError && e.code === Code.NotFound) {
          logger.warn(`Storage path ${userStoragePath} not found for user ${userId}, skipping`);
        } else {
          throw e;
        }
      }
    }
  }
}

/**
 * 将指定用户的家目录及各存储挂载点的个人目录文件所属组修改为指定 GID 的组。
 */
export async function changeUserFileGroup(
  em: SqlEntityManager<MySqlDriver>,
  userId: string,
  userUidNumber: number,
  targetGid: number,
  operatorId: string,
  logger: Logger,
): Promise<void> {
  const currentActivatedClusters = await getActivatedClusters(em, logger);
  const activatedClusterIds = new Set(Object.keys(currentActivatedClusters));

  for (const [clusterId, clusterConfig] of Object.entries(configClusters)) {
    if (!activatedClusterIds.has(clusterId)) continue;
    const scowdClient = getScowdClient(clusterId);

    await changeUserFileGroupForCluster(
      scowdClient,
      clusterConfig.entryPaths,
      userId,
      userUidNumber,
      targetGid,
      operatorId,
      clusterId,
      logger,
    );
  }
}

/**
 * 将平台下所有用户的家目录及各存储挂载点的个人目录文件所属组修改为对应账户组。
 * 完成后将 ACCOUNT_STORAGE_QUOTA_STATE 状态置为 ENABLED；
 * 出错时回滚为 DISABLED。
 */
export async function changeAllUsersFileGroupToAccountGroup(
  em: SqlEntityManager<MySqlDriver>,
  operatorId: string,
  groupService: IGroupService,
  logger: Logger,
): Promise<void> {
  const currentActivatedClusters = await getActivatedClusters(em, logger);
  const activatedClusterIds = new Set(Object.keys(currentActivatedClusters));

  const allUsers = await em.find(User, { state: { $ne: UserState.DELETED } }, { populate: ["accounts.account"] });

  const BATCH_SIZE = 50;
  for (let i = 0; i < allUsers.length; i += BATCH_SIZE) {
    const batch = allUsers.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (user) => {
        const userAccountEntry = user.accounts
          .getItems()
          .find((ua) => ua.account.getEntity().state !== AccountState.DELETED);
        if (!userAccountEntry) return;

        const accountGroupName = userAccountEntry.account.getEntity().accountGroupName!;

        const accountGroupGid = await groupService.getGroupGid(accountGroupName);
        if (accountGroupGid === undefined) {
          throw new Error(`Account group ${accountGroupName} not found in directory for user ${user.userId}`);
        }

        const userUidNumber = await groupService.getUserUidNumber(user.userId);
        if (userUidNumber === undefined) {
          throw new Error(`uidNumber not found for user ${user.userId}`);
        }

        for (const [clusterId, clusterConfig] of Object.entries(configClusters)) {
          if (!activatedClusterIds.has(clusterId)) continue;

          const scowdClient = getScowdClient(clusterId);

          try {
            await changeUserFileGroupForCluster(
              scowdClient,
              clusterConfig.entryPaths,
              user.userId,
              userUidNumber,
              accountGroupGid,
              operatorId,
              clusterId,
              logger,
            );
          } catch (e) {
            logger.error(
              { err: e, userId: user.userId, clusterId, accountGroupGid },
              "changeUserFileGroupForCluster failed",
            );
            throw e;
          }
        }
      }),
    );
  }

  await setBlockedAccountsStorageQuotaOnEnable(em, currentActivatedClusters, logger);

  const finalStateRecord = await em.findOne(SystemState, { key: SystemState.KEYS.ACCOUNT_STORAGE_QUOTA_STATE });
  if (finalStateRecord) {
    finalStateRecord.value = ACCOUNT_QUOTA_STATE.ENABLED;
    await em.persistAndFlush(finalStateRecord);
  }
}

async function setBlockedAccountsStorageQuotaOnEnable(
  em: SqlEntityManager<MySqlDriver>,
  currentActivatedClusters: Awaited<ReturnType<typeof getActivatedClusters>>,
  logger: Logger,
) {
  // OceanStor Pacific 使用原始 LDAP 组名；解析函数仅为其他文件系统处理数字组名。
  const clusterConfigs = getClusterConfigs(undefined, logger);
  const activatedClusterIds = new Set(Object.keys(currentActivatedClusters));
  const executableStorageIds = getExecutableStorageIds(clusterConfigs, activatedClusterIds);

  if (executableStorageIds.length === 0) return;

  const blockedAccounts = await em.find(Account, {
    blockedInCluster: true,
    state: { $ne: AccountState.DELETED },
  });

  if (blockedAccounts.length === 0) return;

  const executionTargets = await Promise.all(
    executableStorageIds.map(async (storageId) => ({
      storageId,
      ...(await resolveStorageExecutionTarget(storageId, em, logger)),
    })),
  );
  const accountGroupNames = blockedAccounts.map((account) => account.accountGroupName!);
  const { groupNameMap } = await resolveScowdQuotaGroupNames(
    accountGroupNames,
    executionTargets.map(({ storageId, executionCluster, executionStorage }) => ({
      ...executionStorage,
      storageId,
      clusterId: executionCluster,
    })),
    logger,
  );

  for (const { executionStorage } of executionTargets) {
    for (const account of blockedAccounts) {
      await executeStorageOperationWithFailover(executionStorage.storageId, em, logger, async (target) =>
        getScowdClient(target.executionCluster).storageQuota.setGroupStorageQuota({
          groupName: getScowdQuotaGroupNameForStorage(
            account.accountGroupName!, target.executionStorage, groupNameMap,
          ),
          path: target.executionPath,
          quotaMb: BLOCKED_ACCOUNT_QUOTA_MB,
          storage: buildStorageConfigProto(target.executionStorage),
        }),
      );
    }
  }
}

async function rollbackBlockedQuotas(
  em: SqlEntityManager<MySqlDriver>,
  account: Loaded<Account, "tenant">,
  groupOps: {
    storageId: string;
    executionCluster: string;
    executionPath: string;
    executionStorage: ServerStorageConfig;
    scowdAccountGroupName: string;
  }[],
  logger: Logger,
) {
  for (const op of groupOps) {
    try {
      const accountQuota = await em.findOne(AccountStorageQuota, { account, storageId: op.storageId });
      let restoredQuotaMb: bigint;
      if (accountQuota?.storageQuotaMb) {
        restoredQuotaMb = accountQuota.storageQuotaMb;
      } else {
        const tenantQuota = await em.findOne(TenantStorageQuota, { tenant: account.tenant, storageId: op.storageId });
        if (tenantQuota?.accountDefaultQuota != null) {
          restoredQuotaMb = tenantQuota.accountDefaultQuota;
        } else {
          const { result: { totalStorageMb } } = await executeStorageOperationWithFailover(
            op.storageId,
            em,
            logger,
            (target) => getScowdClient(target.executionCluster).storageQuota.getFilesystemStorageUsage({
              path: target.executionPath,
            }),
          );
          restoredQuotaMb = BigInt(totalStorageMb);
        }
      }
      await executeStorageOperationWithFailover(op.storageId, em, logger, (target) =>
        getScowdClient(target.executionCluster).storageQuota.setGroupStorageQuota({
          groupName: op.scowdAccountGroupName,
          path: target.executionPath,
          quotaMb: restoredQuotaMb,
          storage: buildStorageConfigProto(target.executionStorage),
        }),
      );
    } catch (e) {
      logger.error("Failed to rollback group quota for storage %s: %o", op.storageId, e);
    }
  }
}

async function rollbackRestoredQuotas(
  em: SqlEntityManager<MySqlDriver>,
  groupOps: {
    storageId: string;
    executionCluster: string;
    executionPath: string;
    executionStorage: ServerStorageConfig;
    scowdAccountGroupName: string;
  }[],
  logger: Logger,
) {
  for (const op of groupOps) {
    try {
      await executeStorageOperationWithFailover(op.storageId, em, logger, (target) =>
        getScowdClient(target.executionCluster).storageQuota.setGroupStorageQuota({
          groupName: op.scowdAccountGroupName,
          path: target.executionPath,
          quotaMb: BLOCKED_ACCOUNT_QUOTA_MB,
          storage: buildStorageConfigProto(target.executionStorage),
        }),
      );
    } catch (e) {
      logger.error("Failed to rollback restored group quota: %o", e);
    }
  }
}

/** OceanStor Pacific 不进行数字组名转换，其他文件系统使用本批次的 LDAP gid 映射。 */
export async function blockAccountStorageQuotas(
  em: SqlEntityManager<MySqlDriver>,
  account: Loaded<Account, "tenant">,
  logger: Logger,
) {
  const clusterConfigs = getClusterConfigs(undefined, logger);
  const currentActivatedClusters = await getActivatedClusters(em, logger);
  const activatedClusterIds = new Set(Object.keys(currentActivatedClusters));
  const executableStorageIds = getExecutableStorageIds(clusterConfigs, activatedClusterIds);

  if (executableStorageIds.length === 0) return;

  const executionTargets = await Promise.all(
    executableStorageIds.map(async (storageId) => ({
      storageId,
      ...(await resolveStorageExecutionTarget(storageId, em, logger)),
    })),
  );
  const accountGroupName = account.accountGroupName!;
  const { groupNameMap } = await resolveScowdQuotaGroupNames(
    [accountGroupName],
    executionTargets.map(({ storageId, executionCluster, executionStorage }) => ({
      ...executionStorage,
      storageId,
      clusterId: executionCluster,
    })),
    logger,
  );

  const successfulGroupOps: {
    storageId: string;
    executionCluster: string;
    executionPath: string;
    executionStorage: ServerStorageConfig;
    scowdAccountGroupName: string;
  }[] = [];
  try {
    for (const { storageId, executionStorage } of executionTargets) {
      const scowdAccountGroupName = getScowdQuotaGroupNameForStorage(accountGroupName, executionStorage, groupNameMap);
      const successfulTarget = await executeStorageOperationWithFailover(storageId, em, logger, async (target) =>
        getScowdClient(target.executionCluster).storageQuota.setGroupStorageQuota({
          groupName: getScowdQuotaGroupNameForStorage(accountGroupName, target.executionStorage, groupNameMap),
          path: target.executionPath,
          quotaMb: BLOCKED_ACCOUNT_QUOTA_MB,
          storage: buildStorageConfigProto(target.executionStorage),
        }),
      );
      successfulGroupOps.push({
        storageId,
        executionCluster: successfulTarget.executionCluster,
        executionPath: successfulTarget.executionPath,
        executionStorage: successfulTarget.executionStorage,
        scowdAccountGroupName,
      });
    }
  } catch (e) {
    logger.warn("Failed to block storage quotas for account %s: %o", account.accountName, e);
    await rollbackBlockedQuotas(em, account, successfulGroupOps, logger);
    throw e instanceof ServiceError
      ? e
      : new ServiceError({
          code: status.INTERNAL,
          message: `Storage quota blocking failed for account ${account.accountName}`,
        });
  }
}

/** OceanStor Pacific 不进行数字组名转换，其他文件系统使用本批次的 LDAP gid 映射。 */
export async function restoreBlockedAccountStorageQuotas(
  em: SqlEntityManager<MySqlDriver>,
  account: Loaded<Account, "tenant">,
  logger: Logger,
) {
  const clusterConfigs = getClusterConfigs(undefined, logger);
  const currentActivatedClusters = await getActivatedClusters(em, logger);
  const activatedClusterIds = new Set(Object.keys(currentActivatedClusters));
  const executableStorageIds = getExecutableStorageIds(clusterConfigs, activatedClusterIds);

  if (executableStorageIds.length === 0) return;

  const executionTargets = await Promise.all(
    executableStorageIds.map(async (storageId) => ({
      storageId,
      ...(await resolveStorageExecutionTarget(storageId, em, logger)),
    })),
  );
  const accountGroupName = account.accountGroupName!;
  const { groupNameMap } = await resolveScowdQuotaGroupNames(
    [accountGroupName],
    executionTargets.map(({ storageId, executionCluster, executionStorage }) => ({
      ...executionStorage,
      storageId,
      clusterId: executionCluster,
    })),
    logger,
  );

  const successfulGroupOps: {
    storageId: string;
    executionCluster: string;
    executionPath: string;
    executionStorage: ServerStorageConfig;
    scowdAccountGroupName: string;
  }[] = [];
  try {
    for (const { storageId, executionStorage } of executionTargets) {
      const scowdAccountGroupName = getScowdQuotaGroupNameForStorage(accountGroupName, executionStorage, groupNameMap);

      const accountQuota = await em.findOne(AccountStorageQuota, { account, storageId });
      let restoredQuotaMb: bigint;

      if (accountQuota?.storageQuotaMb) {
        restoredQuotaMb = accountQuota.storageQuotaMb;
      } else {
        const tenantQuota = await em.findOne(TenantStorageQuota, { tenant: account.tenant, storageId });
        if (tenantQuota?.accountDefaultQuota != null) {
          restoredQuotaMb = tenantQuota.accountDefaultQuota;
        } else {
          const { result: { totalStorageMb } } = await executeStorageOperationWithFailover(
            storageId,
            em,
            logger,
            (target) => getScowdClient(target.executionCluster).storageQuota.getFilesystemStorageUsage({
              path: target.executionPath,
            }),
          );
          restoredQuotaMb = BigInt(totalStorageMb);
        }
      }
      const successfulTarget = await executeStorageOperationWithFailover(storageId, em, logger, async (target) =>
        getScowdClient(target.executionCluster).storageQuota.setGroupStorageQuota({
          groupName: getScowdQuotaGroupNameForStorage(accountGroupName, target.executionStorage, groupNameMap),
          path: target.executionPath,
          quotaMb: restoredQuotaMb,
          storage: buildStorageConfigProto(target.executionStorage),
        }),
      );
      successfulGroupOps.push({
        storageId,
        executionCluster: successfulTarget.executionCluster,
        executionPath: successfulTarget.executionPath,
        executionStorage: successfulTarget.executionStorage,
        scowdAccountGroupName,
      });
    }
  } catch (e) {
    logger.warn("Failed to restore storage quotas for account %s: %o", account.accountName, e);
    await rollbackRestoredQuotas(em, successfulGroupOps, logger);
    throw e instanceof ServiceError
      ? e
      : new ServiceError({
          code: status.INTERNAL,
          message: `Storage quota unblocking failed for account ${account.accountName}`,
        });
  }
}
/**
 * 账户存储配额开启时，将用户切换到账户组：
 * 设置主组为账户组、从默认组移除、修改家目录及个人目录文件所属组为账户所对应的组。
 * 失败时回滚已完成的 LDAP 操作，并调用 onError 处理外层清理。
 */
export async function switchUserToAccountGroup(
  groupService: IGroupService,
  em: SqlEntityManager<MySqlDriver>,
  userId: string,
  accountGroupName: string,
  operatorId: string,
  misConfig: MisConfigSchema,
  logger: Logger,
  onError: (e: unknown) => Promise<never>,
): Promise<void> {
  const { defaultGroupName, accountGroupGid, userUidNumber } = await (async () => {
    const defaultGroupGid = await getDefaultGroupGid(groupService, userId, misConfig);
    if (defaultGroupGid === undefined) {
      throw new Error(`Could not determine default group GID for user ${userId}`);
    }
    const defaultGroupName = await groupService.getGroupNameByGid(defaultGroupGid);
    if (!defaultGroupName) {
      throw new Error(`Could not find default group for user ${userId} (gid: ${defaultGroupGid})`);
    }
    const accountGroupGid = await groupService.getGroupGid(accountGroupName);
    if (accountGroupGid === undefined) {
      throw new Error(`Account group ${accountGroupName} GID not found`);
    }
    const userUidNumber = await groupService.getUserUidNumber(userId);
    if (userUidNumber === undefined) {
      throw new Error(`uidNumber not found for user ${userId}`);
    }
    return { defaultGroupName, accountGroupGid, userUidNumber };
  })().catch((e) => onError(e));

  let primaryGroupSet = false;
  let defaultGroupRemoved = false;
  try {
    await groupService.setUserPrimaryGroup(userId, accountGroupName);
    primaryGroupSet = true;

    await groupService.removeUserFromGroup(userId, defaultGroupName);
    defaultGroupRemoved = true;

    await changeUserFileGroup(em, userId, userUidNumber, accountGroupGid, operatorId, logger);
  } catch (e) {
    if (defaultGroupRemoved) {
      await groupService.addUserToGroup(userId, defaultGroupName).catch((rollbackErr) => {
        logger.error(`Rollback failed: re-add user ${userId} to default group ${defaultGroupName}: ${rollbackErr}`);
      });
    }
    if (primaryGroupSet) {
      await groupService.setUserPrimaryGroup(userId, defaultGroupName).catch((rollbackErr) => {
        logger.error(`Rollback failed: reset primary group for user ${userId} to ${defaultGroupName}: ${rollbackErr}`);
      });
    }
    await onError(e);
  }
}

/**
 * 账户存储配额开启时，将用户的家目录及存储路径文件所属组恢复为默认组 GID。
 */
export async function revertUserFileGroupToDefault(
  groupService: IGroupService,
  em: SqlEntityManager<MySqlDriver>,
  userId: string,
  operatorId: string,
  misConfig: MisConfigSchema,
  logger: Logger,
): Promise<void> {
  const defaultGroupGid = await getDefaultGroupGid(groupService, userId, misConfig);
  if (defaultGroupGid === undefined) {
    throw new Error(`Could not determine default group GID for user ${userId}`);
  }
  const userUidNumber = await groupService.getUserUidNumber(userId);
  if (userUidNumber === undefined) {
    throw new Error(`uidNumber not found for user ${userId}`);
  }
  await changeUserFileGroup(em, userId, userUidNumber, defaultGroupGid, operatorId, logger);
}
