import { Logger } from "@ddadaal/tsgrpc-server";
import { ServiceError } from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
import { ClusterConfigSchema } from "@scow/config/build/cluster";
import { ScowResourcePlugin } from "@scow/lib-scow-resource";
import { mapTRPCExceptionToGRPC } from "@scow/lib-scow-resource/build/utils";
import { blockAccount, unblockAccount } from "src/bl/block";
import { misConfig } from "src/config/mis";
import { Account, AccountState } from "src/entities/Account";
import { AccountAppBlacklist } from "src/entities/AccountAppBlacklist";
import { AccountWhitelist } from "src/entities/AccountWhitelist";
import { SystemState } from "src/entities/SystemState";
import { Tenant } from "src/entities/Tenant";
import { TenantDefaultAppRemovedList } from "src/entities/TenantDefaultAppRemovedList";
import { User } from "src/entities/User";
import { UserAccount, UserRole, UserStatus } from "src/entities/UserAccount";
import { ClusterPlugin } from "src/plugins/clusters";
import { getAccountGroupName } from "src/utils/account";
import { DEFAULT_TENANT_NAME } from "src/utils/constants";
import {
  getGroupService,
  LDAP_GROUP_OPERATION_BATCH_SIZE,
  validateUserAccountGroupBeforeJoin,
} from "src/utils/directoryGroup";
import { toRef } from "src/utils/orm";
import {
  ACCOUNT_QUOTA_STATE,
  blockAccountStorageQuotas,
  checkAndFixUserGroupsForAccountQuota,
  prepareImportedRelationsForAccountQuota,
  setNewUserStorageQuota,
  validateImportedUserAccountRelations,
} from "src/utils/storageQuota";

export interface ImportUsersData {
  accounts: {
    accountName: string;
    users: { userId: string; userName: string; blocked: boolean }[];
    owner: string;
    blocked: boolean;
  }[];
}

export async function importUsers(
  data: ImportUsersData,
  em: SqlEntityManager<MySqlDriver>,
  whitelistAll: boolean,
  currentActivatedClusters: Record<string, ClusterConfigSchema>,
  clusterPlugin: ClusterPlugin["clusters"],
  logger: Logger,
  scowResourcePlugin: ScowResourcePlugin["resource"],
) {
  const tenant = await em.findOneOrFail(Tenant, { name: DEFAULT_TENANT_NAME });

  const usersMap: Record<string, User> = {};

  const idsWithoutName = [] as string[];
  data.accounts.forEach(({ users }) => {
    users.forEach(({ userId, userName }) => {
      if (!(userId in usersMap)) {
        usersMap[userId] = new User({ name: userName === "" ? userId : userName, userId, email: "", tenant });
        if (userName === "") {
          idsWithoutName.push(userId);
        }
      }
    });
  });

  const existingUsers = await em.find(User, { userId: { $in: Object.keys(usersMap) } }, { populate: ["tenant"] });
  existingUsers.forEach((u) => {
    if (u.tenant.$.name !== DEFAULT_TENANT_NAME) {
      throw {
        code: Status.INVALID_ARGUMENT,
        message: `user ${u.userId} has existing and belongs to ${u.tenant.$.name}`,
      } as ServiceError;
    }
    usersMap[u.userId] = u;
  });

  const accountMap: Record<string, Account> = {};
  data.accounts.forEach((account) => {
    // 导入账户时，如果在集群中的账户状态为封锁，则scow同步封锁状态，默认为被上级手动封锁

    // 导入账户时，如果在集群中的账户状态正常，则 SCOW 同步为正常状态，只有已授权分区可用
    accountMap[account.accountName] = new Account({
      accountName: account.accountName,
      comment: "",
      blockedInCluster: Boolean(account.blocked),
      tenant,
      state: account.blocked ? AccountState.BLOCKED_BY_ADMIN : AccountState.NORMAL,
    });
  });
  const existingAccounts = await em.find(
    Account,
    { accountName: { $in: data.accounts.map((x) => x.accountName) } },
    { populate: ["tenant"] },
  );
  existingAccounts.forEach((a) => {
    if (a.tenant.$.name !== DEFAULT_TENANT_NAME) {
      throw {
        code: Status.INVALID_ARGUMENT,
        message: `account ${a.accountName} has existing and belongs to ${a.tenant.$.name}`,
      } as ServiceError;
    }
    accountMap[a.accountName] = a;
  });

  const accounts: Account[] = [];
  const userAccounts: UserAccount[] = [];

  const quotaStateRecord = await em.findOne(SystemState, {
    key: SystemState.KEYS.ACCOUNT_STORAGE_QUOTA_STATE,
  });
  const quotaState = quotaStateRecord?.value ?? ACCOUNT_QUOTA_STATE.DISABLED;
  if (quotaState === ACCOUNT_QUOTA_STATE.ENABLING) {
    throw { code: Status.FAILED_PRECONDITION, details: "QUOTA_ENABLING" } as ServiceError;
  }

  if (quotaState === ACCOUNT_QUOTA_STATE.ENABLED) {
    await validateImportedUserAccountRelations(
      em,
      data.accounts.flatMap((account) =>
        account.users.map((user) => ({ userId: user.userId, accountName: account.accountName })),
      ),
    );
  }

  // 获取只需要创建的账户数据
  const existingAccountNames = existingAccounts.map((x) => x.accountName);
  const existingAccountNamesSet =
    existingAccountNames.length > 0 ? new Set(existingAccounts.map((x) => x.accountName)) : undefined;
  const newAccountsToCreate: Account[] = [];

  data.accounts.forEach((a) => {
    const account = accountMap[a.accountName];
    accounts.push(account);

    if (!existingAccountNamesSet?.has(a.accountName)) {
      newAccountsToCreate.push(account);
    }

    a.users.forEach((u) => {
      const user = usersMap[u.userId];
      userAccounts.push(
        new UserAccount({
          account,
          user,
          role: a.owner === u.userId ? UserRole.OWNER : UserRole.USER,
          blockedInCluster: u.blocked ? UserStatus.BLOCKED : UserStatus.UNBLOCKED,
        }),
      );
    });
  });

  const existingUserAccounts = await em.find(UserAccount, {
    $or: userAccounts.map((ua) => ({ user: ua.user, account: ua.account })),
  });
  const existingUserAccountMap = new Map(existingUserAccounts.map((ua) => [`${ua.user.id}-${ua.account.id}`, ua]));

  const indexes: number[] = [];
  for (const userAccount of userAccounts) {
    const key = `${userAccount.user.id}-${userAccount.account.id}`;
    if (existingUserAccountMap.has(key)) {
      indexes.push(userAccounts.indexOf(userAccount));
    }
  }
  let finalUserAccounts = userAccounts.filter((_, i) => !indexes.includes(i));

  const groupService = await getGroupService(em, logger);
  if (quotaState === ACCOUNT_QUOTA_STATE.ENABLED && !groupService) {
    throw { code: Status.FAILED_PRECONDITION, details: "USER_GROUP_NOT_ENABLED" } as ServiceError;
  }

  if (groupService && finalUserAccounts.length > 0) {
    // 目录组功能开启时始终维护账户组；配额模式下额外修改主组、文件属组和底层配额。
    const relationKeys = new Set<string>();
    const relationsToPrepare = finalUserAccounts.filter((relation) => {
      const key = `${relation.user.getEntity().userId}-${relation.account.getEntity().accountName}`;
      if (relationKeys.has(key)) return false;
      relationKeys.add(key);
      return true;
    });
    finalUserAccounts = relationsToPrepare;
    const existingOwnerRelations = await em.find(
      UserAccount,
      {
        account: {
          accountName: { $in: relationsToPrepare.map((relation) => relation.account.getEntity().accountName) },
        },
        role: UserRole.OWNER,
      },
      { populate: ["account", "user"] },
    );
    const existingOwnerIds = new Map(
      existingOwnerRelations.map((relation) => [relation.account.$.accountName, relation.user.$.userId]),
    );
    const importedOwnerIds = new Map(data.accounts.map((account) => [account.accountName, account.owner]));
    const relationsForQuota = relationsToPrepare.map((relation) => ({
      account: relation.account.getEntity(),
      userId: relation.user.getEntity().userId,
      ownerId:
        importedOwnerIds.get(relation.account.getEntity().accountName) ??
        existingOwnerIds.get(relation.account.getEntity().accountName)!,
    }));

    // 配额模式先按与后续修正一致的 LDAP 批次校验，并复用组查询结果。
    if (quotaState === ACCOUNT_QUOTA_STATE.ENABLED) {
      const cachedGroups = new Map<string, { name: string; gid: number | undefined }[]>();
      const uniqueRelations = [...new Map(relationsForQuota.map((relation) => [relation.userId, relation])).values()];
      for (let i = 0; i < uniqueRelations.length; i += LDAP_GROUP_OPERATION_BATCH_SIZE) {
        await Promise.all(uniqueRelations.slice(i, i + LDAP_GROUP_OPERATION_BATCH_SIZE).map(async (relation) => {
          const targetAccountGroupName = relation.account.accountGroupName
            ?? getAccountGroupName(relation.account.accountName);
          const state = await validateUserAccountGroupBeforeJoin(
            groupService,
            relation.userId,
            targetAccountGroupName,
            misConfig,
            logger,
          );
          cachedGroups.set(relation.userId, state.groups);
        }));
      }
      await checkAndFixUserGroupsForAccountQuota(
        [...new Set(relationsToPrepare.map((relation) => relation.user.getEntity().userId))],
        groupService,
        misConfig,
        cachedGroups,
      );
    }
    await prepareImportedRelationsForAccountQuota(
      em,
      relationsForQuota,
      groupService,
      misConfig,
      whitelistAll,
      logger,
      quotaState === ACCOUNT_QUOTA_STATE.ENABLED,
    );
  }

  if (newAccountsToCreate.length > 0) {
    logger.info("Add assignment of clusters and partitions to %s new accounts", newAccountsToCreate.length);
    await Promise.all(
      newAccountsToCreate.map(async (acc) => {
        // 失败时已写入的数据不回滚, 再次创同名租户账户时会重新写入默认授权分区
        await scowResourcePlugin
          .assignAccountOnCreate({
            accountName: acc.accountName,
            tenantName: tenant.name,
          })
          .catch(async (e) => {
            logger.info(
              "Error occured when write in new account assigned info, accountName: %s, tenantName: %s, details: %s",
              acc.accountName,
              tenant.name,
              e,
            );
            throw mapTRPCExceptionToGRPC(e);
          });
      }),
    );
  }

  const accountAppBlacklistsToPersist: AccountAppBlacklist[] = [];
  // 新建账户时按照所属租户禁用的默认应用列表来写入账户禁用app
  if (newAccountsToCreate.length > 0) {
    const affiliatedTenantBlackAppList = await em.find(
      TenantDefaultAppRemovedList,
      {
        tenant: tenant,
      },
      { populate: ["tenant"] },
    );

    if (affiliatedTenantBlackAppList.length > 0) {
      logger.info("Add app blacklist to %s new accounts", newAccountsToCreate.length);
      const accountDisabledApps = newAccountsToCreate.flatMap((account) => {
        return affiliatedTenantBlackAppList.map((t) => {
          return new AccountAppBlacklist({
            account: account,
            cluster: t.cluster,
            appId: t.appId,
            appScope: t.appScope,
          });
        });
      });
      // 将禁用应用列表添加到要持久化的实体列表中
      accountAppBlacklistsToPersist.push(...accountDisabledApps);
    }
  }

  await em.persistAndFlush([
    ...Object.values(usersMap),
    ...accounts,
    ...finalUserAccounts,
    ...accountAppBlacklistsToPersist,
  ]);

  for (const user of Object.values(usersMap)) {
    // 导入重试时用户可能已由上一次失败落库；对本批用户重新收敛缺失存储的配额。
    // 已成功初始化的 storageId 会由 setNewUserStorageQuota 幂等跳过。
    await setNewUserStorageQuota(em, DEFAULT_TENANT_NAME, user.userId, logger);
  }

  // 账户信息导入scow完成后，更新slurm的block状态
  const failedUnblockAccounts = [] as string[];
  const failedBlockAccounts = [] as string[];
  // 加入白名单的账户不受租户默认封锁阈值影响；未加入白名单时，阈值大于等于0则需要封锁账户
  const shouldBlockInCluster = !whitelistAll && tenant.defaultAccountBlockThreshold.gte(0);
  // 加入白名单时解封所有导入账户；否则在无需封锁时，收敛当前未封锁账户的授权分区
  const accountsToUnblock = whitelistAll
    ? accounts
    : !shouldBlockInCluster
      ? accounts.filter((a) => !a.blockedInCluster)
      : [];
  // 仅对根据租户默认阈值需要封锁、且当前尚未封锁的账户执行封锁
  const accountsToBlock = shouldBlockInCluster ? accounts.filter((a) => !a.blockedInCluster) : [];
  // 导入时已经处于封锁状态的账户不会再次调用 blockAccount，但仍需收敛账户组存储配额。
  const blockedAccountsToReconcileStorage =
    quotaState === ACCOUNT_QUOTA_STATE.ENABLED && !whitelistAll ? accounts.filter((a) => a.blockedInCluster) : [];

  if (accountsToUnblock.length > 0) {
    await Promise.allSettled(
      accountsToUnblock.map((acc) => {
        return em.transactional(async (em) => {
          const account = await em.findOne(Account, { accountName: acc.accountName }, { populate: ["tenant"] });
          if (!account) {
            failedUnblockAccounts.push(acc.accountName);
          } else {
            if (whitelistAll) {
              logger.info("Add %s to whitelist", account.accountName);
              const whitelist = new AccountWhitelist({
                account,
                comment: "initial",
                operatorId: "",
              });
              account.whitelist = toRef(whitelist);
              // 加入白名单后账户状态变为正常
              account.state = AccountState.NORMAL;
              await em.persistAndFlush(whitelist);
            }
            try {
              await unblockAccount(account, currentActivatedClusters, clusterPlugin, logger, scowResourcePlugin, em, true);
            } catch (e) {
              // 集群解锁账户失败，记录失败账户
              logger.warn("Unblock account %s failed during importing users: %o", account.accountName, e);
              failedUnblockAccounts.push(account.accountName);
              throw e;
            }
          }
        });
      }),
    );
  }

  if (accountsToBlock.length > 0) {
    // 出现失败时记录失败信息，但不会抛出错误
    await Promise.allSettled(
      accountsToBlock.map((acc) => {
        return em.transactional(async (em) => {
          const account = await em.findOne(Account, { accountName: acc.accountName }, { populate: ["tenant"] });
          if (!account) {
            failedBlockAccounts.push(acc.accountName);
          } else {
            try {
              await blockAccount(account, currentActivatedClusters, clusterPlugin, logger, em);
            } catch (e) {
              // 集群封锁账户失败，记录失败账户
              logger.warn("Block account %s failed during importing users: %o", account.accountName, e);
              failedBlockAccounts.push(account.accountName);
              throw e;
            }
          }
        });
      }),
    );
  }

  // 对于scow未执行封锁，维持集群封锁状态的账户
  // 执行账户配额封锁
  if (blockedAccountsToReconcileStorage.length > 0) {
    await Promise.allSettled(
      blockedAccountsToReconcileStorage.map((acc) =>
        em.transactional(async (em) => {
          const account = await em.findOne(Account, { accountName: acc.accountName }, { populate: ["tenant"] });
          if (!account) {
            failedBlockAccounts.push(acc.accountName);
            return;
          }

          try {
            await blockAccountStorageQuotas(em, account, logger);
          } catch (e) {
            logger.warn(
              "Reconcile blocked account %s storage quota failed during importing users: %o",
              account.accountName,
              e,
            );
            failedBlockAccounts.push(account.accountName);
            throw e;
          }
        }),
      ),
    );
  }
  logger.info(
    `Import users complete. ${accounts.length} accounts, \
      ${Object.keys(usersMap).length - existingUsers.length} users.`,
  );
  if (idsWithoutName.length !== 0) {
    logger.warn(`${idsWithoutName.length} users don't have names.`);
    logger.warn(idsWithoutName.join(", "));
  }
  if (failedUnblockAccounts.length !== 0) {
    logger.warn(`${failedUnblockAccounts.length} accounts failed to unblock.`);
    logger.warn(failedUnblockAccounts.join(", "));
  }
  if (failedBlockAccounts.length !== 0) {
    logger.warn(`${failedBlockAccounts.length} accounts failed to block.`);
    logger.warn(failedBlockAccounts.join(", "));
  }

  return {
    accountCount: accounts.length - existingAccounts.length,
    userCount: Object.keys(usersMap).length - existingUsers.length,
    usersWithoutName: idsWithoutName.length,
  };
}
