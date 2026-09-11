import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ServiceError as GrpcServiceError } from "@ddadaal/tsgrpc-common";
import { ensureNotUndefined, plugin } from "@ddadaal/tsgrpc-server";
import { ServiceError, status } from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { LockMode, raw, UniqueConstraintViolationException } from "@mikro-orm/core";
import { createAccount, removeUserFromAccount } from "@scow/lib-auth";
import { Decimal, decimalToMoney, moneyToNumber } from "@scow/lib-decimal";
import { mapTRPCExceptionToGRPC } from "@scow/lib-scow-resource/build/utils";
import { scowErrorMetadata } from "@scow/lib-server/build/error";
import { TargetType } from "@scow/notification-protos/build/message_common_pb";
import {
  Account as AccountProto,
  account_AccountStateFromJSON,
  Account_DisplayedAccountState,
  AccountServiceServer,
  AccountServiceService,
  BlockAccountResponse_Result,
} from "@scow/protos/build/server/account";
import { blockAccount, unblockAccount } from "src/bl/block";
import { getActivatedClusters } from "src/bl/clustersUtils";
import { authUrl } from "src/config";
import { misConfig } from "src/config/mis";
import { Account, AccountState } from "src/entities/Account";
import { AccountAppBlacklist } from "src/entities/AccountAppBlacklist";
import { AccountStorageQuota } from "src/entities/AccountStorageQuota";
import { AccountWhitelist } from "src/entities/AccountWhitelist";
import { SystemState } from "src/entities/SystemState";
import { Tenant } from "src/entities/Tenant";
import { TenantDefaultAppRemovedList } from "src/entities/TenantDefaultAppRemovedList";
import { User, UserState } from "src/entities/User";
import { UserAccount, UserRole as EntityUserRole, UserRole, UserStatus } from "src/entities/UserAccount";
import { InternalMessageType } from "src/models/messageType";
import { CLUSTEROPS_ERROR_CODE } from "src/plugins/clusters";
import { callHook } from "src/plugins/hookClient";
import { getAccountGroupName } from "src/utils/account";
import { getAccountStateInfo } from "src/utils/accountUserState";
import { countSubstringOccurrences } from "src/utils/countSubstringOccurrences";
import { getDefaultGroupGid, getGroupService, resetPrimaryGroupIfNeeded } from "src/utils/directoryGroup";
import { getAccountOwnerAndAdmin } from "src/utils/getAccountOwnerAndAdmin";
import { toRef } from "src/utils/orm";
import { unblockAccountAssignedPartitionsInCluster } from "src/utils/resourceManagement";
import { getSchedulerAdapterJobsByClusterFeatures } from "src/utils/schedulerAdapterJobTypes";
import { sendMessage } from "src/utils/sendMessage";
import {
  ACCOUNT_QUOTA_STATE,
  initializeCreatedAccountGroupStorageQuota,
  revertUserFileGroupToDefault,
  switchUserToAccountGroup,
} from "src/utils/storageQuota";
import { ensureNoRunningSyncTask } from "src/utils/synchronizationUtils";

function ensureAccountNotDeleted(account: Account) {
  if (account.state === AccountState.DELETED) {
    throw {
      code: Status.NOT_FOUND,
      message: `Account ${account.accountName} has been deleted.`,
    } as ServiceError;
  }
}

export const accountServiceServer = plugin((server) => {
  server.addService<AccountServiceServer>(AccountServiceService, {
    blockAccount: async ({ request, em, logger }) => {
      const { accountName, tenantName } = request;
      logger.info("Received blockAccount request for account %s", accountName);

      // 检查当前是否有正在执行的同步用户账户操作
      await ensureNoRunningSyncTask(em, logger, "block account task");

      const result = await em.transactional(async (em) => {
        const account = await em.findOne(
          Account,
          {
            accountName,
            tenant: { name: tenantName },
          },
          { lockMode: LockMode.PESSIMISTIC_WRITE, populate: ["tenant"] },
        );

        if (!account) {
          logger.warn("Account %s not found during blockAccount", accountName);
          throw {
            code: Status.NOT_FOUND,
            message: `Account ${accountName} is not found`,
          } as ServiceError;
        }

        logger.debug("Account %s found, checking status and running jobs", accountName);

        // 检查账户是否已删除
        ensureAccountNotDeleted(account);

        const currentActivatedClusters = await getActivatedClusters(em, logger);
        const fields = ["job_id", "user", "state", "account"];
        const jobs = await Promise.all(
          Object.entries(currentActivatedClusters).map(async ([cluster, clusterConfig]) => ({
            cluster,
            result: await server.ext.clusters.callOnOne(
              cluster,
              logger,
              async (client) =>
                await getSchedulerAdapterJobsByClusterFeatures(client, clusterConfig, {
                  fields,
                  filter: { users: [], accounts: [accountName], states: ["RUNNING", "PENDING"] },
                }),
            ),
          })),
        );

        if (jobs.filter((i) => i.result.jobs.length > 0).length > 0) {
          logger.warn("Account %s has running jobs, cannot be blocked", accountName);
          throw {
            code: Status.FAILED_PRECONDITION,
            message: `Account ${accountName}  has jobs running and cannot be blocked. `,
          } as ServiceError;
        }

        const blockThresholdAmount = account.blockThresholdAmount ?? account.tenant.$.defaultAccountBlockThreshold;

        const result = await blockAccount(account, currentActivatedClusters, server.ext.clusters, logger, em);

        if (result === "AlreadyBlocked") {
          logger.info("Account %s is already blocked", accountName);

          // 如果账户已被手动冻结，提示账户已被冻结
          // 当前scow暂未使用AccountState.FROZEN
          if (account.state === AccountState.FROZEN) {
            throw {
              code: Status.FAILED_PRECONDITION,
              message: `Account ${accountName} has been frozen. `,
            } as ServiceError;
          }

          // 如果是未欠费（余额大于封锁阈值）账户，提示账户已被封锁
          if (account.balance.gt(blockThresholdAmount)) {
            throw {
              code: Status.FAILED_PRECONDITION,
              message: `Account ${accountName} has been blocked. `,
            } as ServiceError;
          }
        }

        if (result === "Whitelisted") {
          logger.warn("Account %s is whitelisted, cannot be blocked", accountName);
          throw {
            code: Status.FAILED_PRECONDITION,
            message: `The account ${accountName} has been added to the whitelist. `,
          } as ServiceError;
        }

        // 更改数据库中状态值
        account.state = AccountState.BLOCKED_BY_ADMIN;

        logger.info("Account %s blocked successfully", accountName);
        return { result: BlockAccountResponse_Result.OK };
      });

      // 发送消息
      const ownerAndAdmin = await getAccountOwnerAndAdmin(accountName, logger, em);
      await sendMessage(
        {
          messageType: InternalMessageType.AccountLocked,
          targetType: TargetType.USER,
          targetIds: ownerAndAdmin.map((x) => x.userId),
          metadata: {
            time: new Date().toISOString(),
            accountName: accountName,
          },
        },
        logger,
      );

      return [result];
    },

    unblockAccount: async ({ request, em, logger }) => {
      const { accountName, tenantName } = request;
      logger.info("Received unblockAccount request for account %s", accountName);

      // 检查当前是否有正在执行的同步用户账户操作
      await ensureNoRunningSyncTask(em, logger, "unblock account task");

      const result = await em.transactional(async (em) => {
        const account = await em.findOne(
          Account,
          {
            accountName,
            tenant: { name: tenantName },
          },
          { lockMode: LockMode.PESSIMISTIC_WRITE, populate: ["tenant"] },
        );

        if (!account) {
          logger.warn("Account %s not found during unblockAccount", accountName);
          throw {
            code: Status.NOT_FOUND,
            message: `Account ${accountName} is not found`,
          } as ServiceError;
        }

        ensureAccountNotDeleted(account);

        if (!account.blockedInCluster) {
          logger.info("Account %s is already unblocked", accountName);
          throw {
            code: Status.FAILED_PRECONDITION,
            message: `Account ${accountName} is unblocked`,
          } as ServiceError;
        }
        // 将账户从被上级封锁或冻结状态变更为正常
        account.state = AccountState.NORMAL;

        const blockThresholdAmount = account.blockThresholdAmount ?? account.tenant.$.defaultAccountBlockThreshold;

        // 判断解除封锁之后账户是否仍需保持封锁状态
        const shouldBlockInCluster = getAccountStateInfo(
          undefined,
          AccountState.NORMAL,
          account.balance,
          blockThresholdAmount,
        ).shouldBlockInCluster;

        // 解除账户封锁时，若为欠费账户（余额小于等于封锁阈值）则不在集群下解封账户
        if (shouldBlockInCluster) {
          logger.info(
            "Can not unblock %s in clusters because the account's balance less than or equal to the blocking threshold",
            accountName,
          );
          return { executed: true };
        }

        const currentActivatedClusters = await getActivatedClusters(em, logger);
        await unblockAccount(account, currentActivatedClusters, server.ext.clusters, logger, server.ext.resource, em);

        logger.info("Account %s unblocked successfully", accountName);
        return { executed: true };
      });

      // 发送消息
      const ownerAndAdmin = await getAccountOwnerAndAdmin(accountName, logger, em);
      await sendMessage(
        {
          messageType: InternalMessageType.AccountUnblocked,
          targetType: TargetType.USER,
          targetIds: ownerAndAdmin.map((x) => x.userId),
          metadata: {
            time: new Date().toISOString(),
            accountName: accountName,
          },
        },
        logger,
      );

      return [result];
    },

    getAccounts: async ({ request, em, logger }) => {
      const { accountName, tenantName } = request;

      // 1. 定义接口执行结果的类型
      // queryBuilder.execute()基于Knex查询，查出来的结构一般为string类型
      // 对于Decimal等特殊类型，需要单独处理逻辑
      interface RawAccountQueryResult {
        id: string;
        accountName: string;
        state: AccountState;
        // 数据库中原始类型为Decimal
        balance: string;
        // 数据库中原始类型为 boolean
        blockedInCluster: boolean | number;
        comment: string;
        // 数据库中原始类型为Decimal
        blockThresholdAmount: string | undefined;
        tenantName: string;
        // 数据库中原始类型为Decimal
        tenantDefaultAccountBlockThreshold: string;
        whitelistId: number | undefined;
      }

      interface RawOwnerQueryResult {
        accountId: string;
        userId: string;
        name: string;
      }

      interface RawCountQueryResult {
        accountId: string;
        count: number;
      }

      // 2. 使用 QueryBuilder 获取账户列表
      const accounts = await em
        .createQueryBuilder(Account, "a")
        .leftJoin("a.tenant", "t")
        .leftJoin("a.whitelist", "w")
        .select([
          "a.id",
          "a.accountName",
          "a.state",
          "a.balance",
          "a.blockedInCluster",
          "a.comment",
          "a.blockThresholdAmount",
          raw("t.name as tenantName"),
          raw("t.default_account_block_threshold as tenantDefaultAccountBlockThreshold"),
          raw("w.id as whitelistId"),
        ])
        .where({
          ...(tenantName ? { "t.name": tenantName } : {}),
          ...(accountName ? { "a.accountName": accountName } : {}),
        })
        .execute<RawAccountQueryResult[]>();

      const accountIds = accounts.map((a) => a.id);
      if (accounts.length === 0) return [{ results: [] }];

      // 2. 使用 QueryBuilder 批量获取主管理员信息
      const ownersResult = await em
        .createQueryBuilder(UserAccount, "ua")
        .leftJoin("ua.user", "u")
        .select(["ua.account_id as accountId", "u.user_id as userId", "u.name as name"])
        .where({
          account: { $in: accountIds },
          role: UserRole.OWNER,
        })
        .execute<RawOwnerQueryResult[]>();
      const ownerMap = new Map(ownersResult.map((o) => [o.accountId, o]));

      // 3. 使用 QueryBuilder 批量查出 UserCount
      const countsResult = await em
        .createQueryBuilder(UserAccount, "ua")
        .select(["ua.account_id as accountId", raw("count(ua.id) as count")])
        .where({ account: { $in: accountIds } })
        .groupBy("ua.account_id")
        .execute<RawCountQueryResult[]>();

      const userCountMap = new Map(countsResult.map((c) => [c.accountId, c.count]));

      // 批量查询账户存储配额
      interface RawStorageQuotaResult {
        accountId: string;
        storageId: string;
        storageQuotaMb: string | null;
      }
      const storageQuotaRows = await em
        .createQueryBuilder(AccountStorageQuota, "asq")
        .select([
          "asq.account_id as accountId",
          "asq.storage_id as storageId",
          "asq.storage_quota_mb as storageQuotaMb",
        ])
        .where({ account: { $in: accountIds } })
        .execute<RawStorageQuotaResult[]>();

      // storageQuotaMap: accountId -> [{ storageId, quotaMb }]
      const storageQuotaMap = new Map<string, { storageId: string; quotaMb: number }[]>();
      for (const q of storageQuotaRows) {
        if (!storageQuotaMap.has(q.accountId)) storageQuotaMap.set(q.accountId, []);
        storageQuotaMap.get(q.accountId)!.push({ storageId: q.storageId, quotaMb: Number(q.storageQuotaMb ?? 0) });
      }

      const abnormalAccountsWithoutOwner: string[] = [];

      // 4. 组装结果
      const finalResult: AccountProto[] = accounts.map((x) => {
        const owner = ownerMap.get(x.id);
        if (!owner) {
          abnormalAccountsWithoutOwner.push(x.accountName);
        }
        const balanceDec = new Decimal(x.balance || 0);
        const thresholdAmount = x.blockThresholdAmount ?? x.tenantDefaultAccountBlockThreshold;
        const thresholdAmountDec = new Decimal(thresholdAmount || 0);
        const blockThresholdAmountDec = new Decimal(x.blockThresholdAmount || 0);
        const tenantDefaultAccountBlockThresholdDec = new Decimal(x.tenantDefaultAccountBlockThreshold || 0);

        const displayedAccountState = getAccountStateInfo(
          x.whitelistId,
          x.state,
          balanceDec,
          thresholdAmountDec,
        ).displayedState;

        return {
          accountName: x.accountName,
          tenantName: x.tenantName,
          userCount: parseInt(userCountMap.get(x.id)?.toString() || "0"),
          blocked: Boolean(x.blockedInCluster),
          state: account_AccountStateFromJSON(x.state),
          displayedState: displayedAccountState,
          isInWhitelist: Boolean(x.whitelistId),
          ownerId: owner?.userId,
          ownerName: owner?.name,
          comment: x.comment,
          balance: decimalToMoney(balanceDec),
          blockThresholdAmount: x.blockThresholdAmount ? decimalToMoney(blockThresholdAmountDec) : undefined,
          defaultBlockThresholdAmount: decimalToMoney(tenantDefaultAccountBlockThresholdDec),
          storageQuotas: storageQuotaMap.get(x.id) ?? [],
        };
      });

      // 对于没有主管理员的数据保留日志
      if (abnormalAccountsWithoutOwner.length > 0) {
        logger.warn("Accounts without owner is found: " + `${[abnormalAccountsWithoutOwner].join(",")}`);
      }

      return [{ results: finalResult }];
    },

    createAccount: async ({ request, em, logger }) => {
      const { accountName, tenantName, ownerId, comment } = request;
      logger.info("Received createAccount request for account %s under tenant %s", accountName, tenantName);

      const user = await em.findOne(User, { userId: ownerId, tenant: { name: tenantName } });

      if (!user || user.state === UserState.DELETED) {
        logger.warn("User %s under tenant %s not found or deleted", ownerId, tenantName);
        throw {
          code: Status.NOT_FOUND,
          message: `User ${ownerId} under tenant ${tenantName} does not exist or has been deleted`,
        } as ServiceError;
      }

      const tenant = await em.findOne(Tenant, { name: tenantName });
      if (!tenant) {
        logger.warn("Tenant %s not found", tenantName);
        throw {
          code: Status.NOT_FOUND,
          message: `Tenant ${tenantName} is not found`,
        } as ServiceError;
      }

      // 如果配置了目录服务，且 ACCOUNT_GROUP_INITIALIZED 为 true，则启用用户组操作
      const groupService = await getGroupService(em, logger);
      const accountGroupName = getAccountGroupName(accountName);
      // 普通创建账户不复用已有同名目录组；只有导入流程保留既有组恢复逻辑。
      const accountGroupExisted = groupService
        ? await groupService.checkGroupExists(accountGroupName)
        : false;

      // 账户存储配额功能开启时，主管理员不能已经属于其他账户
      const quotaStateRecord = await em.findOne(SystemState, {
        key: SystemState.KEYS.ACCOUNT_STORAGE_QUOTA_STATE,
      });
      const accountQuotaEnabled = quotaStateRecord?.value === ACCOUNT_QUOTA_STATE.ENABLED;

      if (groupService && accountGroupExisted) {
        logger.warn("directory service group %s already exists, cannot create account with this name", accountGroupName);
        throw {
          code: Status.ALREADY_EXISTS,
          message: `The directory service group for account name ${accountName} already exists.`,
          details: "DIRECTORY_GROUP_ALREADY_EXISTS",
        } as ServiceError;
      }

      // 账户配额依赖账户组。正常启用流程会先完成账户组初始化；如果状态不一致，则拒绝创建不完整的账户。
      if (accountQuotaEnabled && !groupService) {
        logger.error("Account storage quota is enabled but account group initialization is incomplete");
        throw {
          code: Status.FAILED_PRECONDITION,
          message: "User group feature is not initialized, cannot initialize account storage quota",
          details: "USER_GROUP_NOT_ENABLED",
        } as ServiceError;
      }

      if (accountQuotaEnabled || quotaStateRecord?.value === ACCOUNT_QUOTA_STATE.ENABLING) {
        const existingUserAccount = await em.findOne(
          UserAccount,
          {
            user: { userId: ownerId, tenant: { name: tenantName } },
            account: { state: { $ne: AccountState.DELETED } },
          },
          { populate: ["account"] },
        );

        if (existingUserAccount) {
          const existingAccountName = existingUserAccount.account.getEntity().accountName;
          logger.warn(
            "User %s already belongs to account %s, cannot create new account when quota is enabled or enabling",
            ownerId,
            existingAccountName,
          );
          throw {
            code: Status.FAILED_PRECONDITION,
            message: `This user already exists in the account ${existingAccountName}, and cannot be the primary admin of a new account`,
            details: "OWNER_ALREADY_IN_ANOTHER_ACCOUNT",
          } as ServiceError;
        }
      }

      // 检查当前是否有正在执行的同步用户账户操作
      await ensureNoRunningSyncTask(em, logger, "create account task");

      // 新建账户时比较租户默认封锁阈值，如果租户默认封锁阈值小于0则保持账户为在集群中可用状态
      // 如果租户默认封锁阈值大于等于0，则封锁账户
      const shouldBlockInCluster: boolean = tenant.defaultAccountBlockThreshold.gte(0);
      logger.debug("Should block account %s in cluster: %s", accountName, shouldBlockInCluster);

      // insert the account now to avoid future conflict
      const account = new Account({
        accountName,
        comment,
        tenant,
        blockedInCluster: shouldBlockInCluster,
        ...(groupService ? { accountGroupName } : {}),
      });

      const userAccount = new UserAccount({
        account,
        user,
        role: EntityUserRole.OWNER,
        blockedInCluster: UserStatus.UNBLOCKED,
      });

      const entitiesToPersist: (Account | UserAccount | AccountAppBlacklist)[] = [account, userAccount];
      // 新建账户时按照所属租户禁用默认应用列表来写入账户禁用app
      const affiliatedTenantBlackAppList = await em.find(
        TenantDefaultAppRemovedList,
        {
          tenant: tenant,
        },
        { populate: ["tenant"] },
      );

      const accountDisabledApps = affiliatedTenantBlackAppList.map((t) => {
        return new AccountAppBlacklist({
          account: account,
          cluster: t.cluster,
          appId: t.appId,
          appScope: t.appScope,
        });
      });
      // 将禁用应用列表添加到要持久化的实体列表中
      entitiesToPersist.push(...accountDisabledApps);

      try {
        await em.persistAndFlush(entitiesToPersist);
      } catch (e) {
        if (e instanceof UniqueConstraintViolationException) {
          logger.warn("Account %s already exists", accountName);
          throw {
            code: Status.ALREADY_EXISTS,
            message: `Account ${accountName} already exists.`,
          } as ServiceError;
        }
      }

      const rollback = async (e: any) => {
        logger.info("Rollback account creation of %s", accountName);
        await em.removeAndFlush([account, userAccount]);
        throw e;
      };

      const handleCreateAccountError = (e: any) => {
        if (e.code === Status.ALREADY_EXISTS) {
          logger.info("Account %s already exists in cluster, proceed to the next step", accountName);
          return true;
        }
        throw e;
      };

      const convergeExistingAccount = async (operation: () => Promise<unknown>, notFoundMessage: string) => {
        await operation().catch((e) => {
          if (e.code === Status.NOT_FOUND) {
            throw {
              code: Status.INTERNAL,
              message: notFoundMessage,
            } as ServiceError;
          }
          throw e;
        });
      };

      // 在目录服务中创建用户组；失败时回滚数据库记录
      if (groupService) {
        if (!accountGroupExisted) {
          await groupService.createGroup(accountGroupName).catch(async (e) => {
            logger.error("Failed to create directory service group %s: %s", accountGroupName, e);
            await rollback({
              code: Status.INTERNAL,
              message: `Failed to create directory service group ${accountGroupName} for account ${accountName}: ${e?.message ?? e}`,
            } as ServiceError);
          });
        }
        await groupService.addUserToGroup(ownerId, accountGroupName).catch(async (e) => {
          logger.error("Failed to add user %s to directory service group %s: %s", ownerId, accountGroupName, e);
          await groupService.deleteGroup(accountGroupName).catch(() => {});
          await rollback({
            code: Status.INTERNAL,
            message: `Failed to add user ${ownerId} to directory service group ${accountGroupName}: ${e?.message ?? e}`,
          } as ServiceError);
        });

        if (accountQuotaEnabled) {
          const rollbackGroupOps = async () => {
            // 普通创建已拒绝既有同名组，此处只清理本次创建的账户组。
            await groupService.removeUserFromGroup(ownerId, accountGroupName).catch((rollbackError) => {
              logger.error(
                "Rollback failed: remove account owner %s from group %s: %s",
                ownerId,
                accountGroupName,
                rollbackError,
              );
            });
            await groupService.deleteGroup(accountGroupName).catch((rollbackError) => {
              logger.error("Rollback failed: delete account group %s: %s", accountGroupName, rollbackError);
            });
          };
          await switchUserToAccountGroup(
            groupService,
            em,
            ownerId,
            accountGroupName,
            ownerId,
            misConfig,
            logger,
            async (e) => {
              await rollbackGroupOps();
              logger.info("Rollback account creation of %s", accountName);
              await em.removeAndFlush([account, userAccount]);
              throw {
                code: Status.INTERNAL,
                message: `Failed to apply quota operations for user ${ownerId}: ${(e as Error)?.message ?? e}. Changes have been rolled back.`,
              } as ServiceError;
            },
          );

          // 账户组、主管理员主组及文件所属组均处理成功后，再初始化账户组的底层存储配额。
          // 任一 scowd 配额下发失败时，初始化函数先封锁已触达的配额，再由这里回滚目录服务和数据库操作。
          await initializeCreatedAccountGroupStorageQuota(
            accountName,
            accountGroupName,
            tenantName,
            shouldBlockInCluster,
            em,
            logger,
          ).catch(async (e) => {
            logger.error("Failed to initialize storage quota for account %s: %s", accountName, e);
            // 恢复 owner 文件的所属组，避免已删除的账户组 GID 继续残留在文件上。
            await revertUserFileGroupToDefault(groupService, em, ownerId, ownerId, misConfig, logger).catch(
              (rollbackError) =>
                logger.error("Rollback failed: restore file group for account owner %s: %s", ownerId, rollbackError),
            );
            // primary group 与默认组 membership 是 LDAP 中两个独立状态，需要分别恢复。
            await resetPrimaryGroupIfNeeded(groupService, ownerId, accountGroupName, misConfig).catch((rollbackError) =>
              logger.error("Rollback failed: reset primary group for account owner %s: %s", ownerId, rollbackError),
            );
            // 解析 owner 的默认组并恢复 LDAP membership；恢复 primary group 不会自动将用户重新加入默认组。
            await (async () => {
              const defaultGroupGid = await getDefaultGroupGid(groupService, ownerId, misConfig);
              if (defaultGroupGid === undefined) {
                throw new Error(`Could not determine default group GID for user ${ownerId}`);
              }
              const defaultGroupName = await groupService.getGroupNameByGid(defaultGroupGid);
              if (!defaultGroupName) {
                throw new Error(`Could not find default group for user ${ownerId} (gid: ${defaultGroupGid})`);
              }
              await groupService.addUserToGroup(ownerId, defaultGroupName);
            })().catch((rollbackError) =>
              logger.error(
                "Rollback failed: restore default group membership for account owner %s: %s",
                ownerId,
                rollbackError,
              ),
            );
            // 用户状态恢复完成后，清理本次创建的账户组及其成员关系。
            await rollbackGroupOps();
            // 最后删除 MIS 中新建的账户及 owner 关系；关联黑名单由数据库外键级联删除。
            await rollback({
              code: Status.INTERNAL,
              message: `Failed to initialize storage quota for account ${accountName}. Changes have been rolled back.`,
            } as ServiceError);
          });
        }
      }

      const currentActivatedClusters = await getActivatedClusters(em, logger);

      // 创建账户失败时写入的默认授权集群分区不会回滚，下次写入同名租户下同名账户默认集群分区时会覆盖
      logger.debug("Assigning account %s to resource management", accountName);
      await server.ext.resource
        .assignAccountOnCreate({
          accountName,
          tenantName: tenant.name,
        })
        .catch(async (e) => {
          const error = mapTRPCExceptionToGRPC(e);
          logger.error("Failed to assign account %s to resource management: %s", accountName, error);
          await rollback(error);
        });

      logger.info("Creating account in cluster.");
      if (shouldBlockInCluster) {
        await Promise.all(
          Object.entries(currentActivatedClusters).map(async ([clusterId]) => {
            await server.ext.clusters.callOnOne(clusterId, logger, async (client) => {
              let accountAlreadyExists = false;
              const authorizedPartitions = await server.ext.resource.getAccountAssignedPartitionsForCluster({
                accountName,
                tenantName: account.tenant.getProperty("name"),
                clusterId,
              });

              await asyncClientCall(client.account, "createAccount", {
                accountName,
                ownerUserId: ownerId,
                accountBlocked: true,
                // 账户原因要求封锁时，adapter 根据 accountBlocked 封锁；授权分区仍表示账户已有资源授权。
                partitionStrategy: {
                  $case: "authorizedPartitions" as const,
                  authorizedPartitions: { partitions: authorizedPartitions ?? [] },
                },
              }).catch((e) => {
                accountAlreadyExists = handleCreateAccountError(e);
              });
              if (accountAlreadyExists) {
                await convergeExistingAccount(
                  () => asyncClientCall(client.account, "blockAccount", { accountName }),
                  `Account ${accountName} hasn't been created. Block failed`,
                );
              }
            });
          }),
        ).catch(async (e) => {
          logger.error("Failed to create/block account %s in clusters: %s", accountName, e);
          await rollback(e);
        });
        // 如果判断为要在集群中解封时
      } else {
        const results = await Promise.allSettled(
          Object.entries(currentActivatedClusters).map(async ([clusterId]) => {
            await server.ext.clusters.callOnOne(clusterId, logger, async (client) => {
              // assignAccountOnCreate 已在前面写入资源管理服务，此处拿到的是租户默认授权分区。
              const authorizedPartitions = await server.ext.resource.getAccountAssignedPartitionsForCluster({
                accountName,
                tenantName: account.tenant.getProperty("name"),
                clusterId,
              });

              let accountAlreadyExists = false;
              await asyncClientCall(client.account, "createAccount", {
                accountName,
                ownerUserId: ownerId,
                accountBlocked: false,
                // 直接按授权分区创建，消除"先全量开放再封锁"的窗口期。
                partitionStrategy: {
                  $case: "authorizedPartitions" as const,
                  authorizedPartitions: { partitions: authorizedPartitions ?? [] },
                },
              }).catch((e) => {
                if (e.code === Status.ALREADY_EXISTS) {
                  logger.info("Account %s already exists in cluster, proceed to the next step", accountName);
                  accountAlreadyExists = true;
                } else {
                  throw e;
                }
              });

              if (accountAlreadyExists) {
                // 账户在 Slurm 中已存在（上次创建失败留下的残留），
                // association 状态未知，通过 realignment 强制收敛到正确授权分区。
                await unblockAccountAssignedPartitionsInCluster(
                  accountName,
                  account.tenant.getProperty("name"),
                  clusterId,
                  server.ext.clusters,
                  logger,
                  server.ext.resource,
                );
              }
            });
          }),
        );

        const errors = results.reduce((acc: { clusterId: string; reason: any }[], result, index) => {
          if (result.status === "rejected") {
            acc.push({ clusterId: Object.keys(currentActivatedClusters)[index], reason: result.reason });
          }
          return acc;
        }, []);

        if (errors.length > 0) {
          const errorDetails = errors
            .map((error) => {
              return `Cluster: ${error?.clusterId}, Reason: ${error?.reason.details || error?.reason}`;
            })
            .join("; ");

          logger.error("Failed to create/unblock account %s in some clusters: %s", accountName, errorDetails);

          const error = new GrpcServiceError({
            code: status.INTERNAL,
            message: `Account ${accountName} hasn't been created. Unblock failed.`,
            details: errorDetails,
            metadata: scowErrorMetadata(CLUSTEROPS_ERROR_CODE, { clusterErrors: JSON.stringify(errorDetails) }),
          });
          // 回滚 mis 数据库中数据
          await rollback(error);
        }
      }

      logger.info("Account %s created successfully", accountName);

      await callHook("accountCreated", { accountName, comment, ownerId, tenantName }, logger);

      if (server.ext.capabilities.accountUserRelation) {
        await createAccount(authUrl, { accountName, ownerUserId: ownerId }, logger);
      }

      return [{}];
    },

    getWhitelistedAccounts: async ({ request, em }) => {
      const { tenantName } = request;

      // 查询所有相关信息
      const results = await em.find(
        AccountWhitelist,
        {
          $and: [{ account: { tenant: { name: tenantName } } }],
        },
        {
          populate: ["account"],
        },
      );

      const owners = await em.find(
        UserAccount,
        {
          account: { accountName: results.map((x) => x.account.$.accountName), tenant: { name: tenantName } },
          role: EntityUserRole.OWNER,
        },
        { populate: ["user"] },
      );

      return [
        {
          accounts: results.map((x) => {
            const accountOwner = owners.find((o) => o.account.id === x.account.id)?.user.$;
            return {
              accountName: x.account.$.accountName,
              comment: x.comment,
              operatorId: x.operatorId,
              addTime: x.time.toISOString(),
              ownerId: (accountOwner?.userId ?? "-") + "",
              ownerName: accountOwner?.name ?? "-",
              balance: decimalToMoney(x.account.$.balance),
              expirationTime: x.expirationTime?.toISOString().includes("2099")
                ? undefined
                : x.expirationTime?.toISOString(),
            };
          }),
        },
      ];
    },

    whitelistAccount: async ({ request, em, logger }) => {
      const { accountName, comment, operatorId, tenantName, expirationTime } = request;
      logger.info("Received whitelistAccount request for account %s by %s", accountName, operatorId);

      // 检查当前是否有正在执行的同步用户账户操作
      await ensureNoRunningSyncTask(em, logger, "whitelist account task");

      const account = await em.findOne(
        Account,
        { accountName, tenant: { name: tenantName } },
        { populate: ["tenant"] },
      );

      if (!account) {
        logger.warn("Account %s not found during whitelistAccount", accountName);
        throw {
          code: Status.NOT_FOUND,
          message: `Account ${accountName} is not found`,
        } as ServiceError;
      }

      ensureAccountNotDeleted(account);

      if (account.whitelist) {
        logger.info("Account %s is already whitelisted", accountName);
        return [{ executed: false }];
      }

      const whitelist = new AccountWhitelist({
        account,
        time: new Date(),
        comment,
        operatorId,
        // expirationTime为undefined时为永久有效
        expirationTime: expirationTime ? new Date(expirationTime) : undefined,
      });
      account.whitelist = toRef(whitelist);

      // 如果移入白名单之前账户状态为冻结，则冻结状态优先级高于白名单，账户在集群中仍为封锁状态，state值不变
      if (account.state === AccountState.FROZEN) {
        logger.info(
          "Add account %s to whitelist by %s with comment %s, but the account is still frozen",
          accountName,
          operatorId,
          comment,
        );
        // 如果移入白名单之前账户状态不为冻结，则账户状态变更为正常，账户在集群中为解封状态
      } else {
        if (account.state !== AccountState.NORMAL) {
          // 发送账户解封消息
          const ownerAndAdmin = await getAccountOwnerAndAdmin(accountName, logger, em);
          await sendMessage(
            {
              messageType: InternalMessageType.AccountUnblocked,
              targetType: TargetType.USER,
              targetIds: ownerAndAdmin.map((x) => x.userId),
              metadata: {
                time: new Date().toISOString(),
                accountName: accountName,
              },
            },
            logger,
          );
        }
        account.state = AccountState.NORMAL;
        const currentActivatedClusters = await getActivatedClusters(em, logger);
        await unblockAccount(account, currentActivatedClusters, server.ext.clusters, logger, server.ext.resource, em);
      }

      await em.persistAndFlush(whitelist);

      logger.info("Add account %s to whitelist by %s with comment %s", accountName, operatorId, comment);

      return [{ executed: true }];
    },

    dewhitelistAccount: async ({ request, em, logger }) => {
      const { accountName, tenantName } = request;

      // 检查当前是否有正在执行的同步用户账户操作
      await ensureNoRunningSyncTask(em, logger, "dewhitelist account task");

      const result = await em.transactional(async (em) => {
        const account = await em.findOne(
          Account,
          {
            accountName,
            tenant: { name: tenantName },
          },
          {
            populate: ["tenant"],
            lockMode: LockMode.PESSIMISTIC_WRITE,
          },
        );

        if (!account) {
          throw {
            code: Status.NOT_FOUND,
            message: `Account ${accountName} is not found`,
          } as ServiceError;
        }

        ensureAccountNotDeleted(account);

        if (!account.whitelist) {
          return { executed: false };
        }

        em.remove(account.whitelist);
        account.whitelist = undefined;

        logger.info("Remove account %s from whitelist", accountName);

        const blockThresholdAmount = account.blockThresholdAmount ?? account.tenant.$.defaultAccountBlockThreshold;

        // 判断移出白名单后是否应在集群中封锁
        const shouldBlockInCluster = getAccountStateInfo(
          undefined,
          account.state,
          account.balance,
          blockThresholdAmount,
        ).shouldBlockInCluster;

        if (shouldBlockInCluster) {
          logger.info("Account %s is out of balance and not whitelisted. Block the account.", account.accountName);
          const currentActivatedClusters = await getActivatedClusters(em, logger);
          await blockAccount(account, currentActivatedClusters, server.ext.clusters, logger, em);
        }

        return { executed: true };
      });

      return [result];
    },

    setBlockThreshold: async ({ request, em, logger }) => {
      // 检查当前是否有正在执行的同步用户账户操作
      await ensureNoRunningSyncTask(em, logger, "set account block threshold task");

      const { accountName, blockThresholdAmount } = request;

      const account = await em.findOne(
        Account,
        { accountName },
        {
          populate: ["tenant"],
        },
      );

      if (!account) {
        throw {
          code: Status.NOT_FOUND,
          message: `Account ${accountName} is not found`,
        } as ServiceError;
      }

      ensureAccountNotDeleted(account);

      account.blockThresholdAmount = blockThresholdAmount
        ? new Decimal(moneyToNumber(blockThresholdAmount))
        : undefined;

      const ownerAndAdmin = await getAccountOwnerAndAdmin(account.accountName, logger, em);
      if (account.balance.lt(account.blockThresholdAmount ?? 0)) {
        await sendMessage(
          {
            messageType: InternalMessageType.AccountOverdue,
            targetType: TargetType.USER,
            targetIds: ownerAndAdmin.map((x) => x.userId),
            metadata: {
              time: new Date().toISOString(),
              accountName: account.accountName,
              amount: account.balance
                .minus(account.blockThresholdAmount ?? 0)
                .abs()
                .toString(),
            },
          },
          logger,
        );
      }

      const currentBlockThreshold = blockThresholdAmount
        ? new Decimal(moneyToNumber(blockThresholdAmount))
        : account.tenant.getProperty("defaultAccountBlockThreshold");

      // 判断设置封锁阈值后是否应该在集群中封锁
      const shouldBlockInCluster = getAccountStateInfo(
        account.whitelist?.id,
        account.state,
        account.balance,
        currentBlockThreshold,
      ).shouldBlockInCluster;

      const currentActivatedClusters = await getActivatedClusters(em, logger);

      if (shouldBlockInCluster) {
        logger.info("Account %s may be out of balance. Block the account.", account.accountName);
        await blockAccount(account, currentActivatedClusters, server.ext.clusters, logger, em);
      }

      if (!shouldBlockInCluster) {
        logger.info(
          "The balance of Account %s is greater than the block threshold amount. " + "Unblock the account.",
          account.accountName,
        );
        await unblockAccount(account, currentActivatedClusters, server.ext.clusters, logger, server.ext.resource, em);
      }

      // 判断移除白名单后是否时欠费状态，如果是则发送账户欠费通知
      if (account.balance.lt(account.blockThresholdAmount ?? 0)) {
        await sendMessage(
          {
            messageType: InternalMessageType.AccountOverdue,
            targetType: TargetType.USER,
            targetIds: ownerAndAdmin.map((x) => x.userId),
            metadata: {
              time: new Date().toISOString(),
              accountName: account.accountName,
              amount: account.balance
                .minus(account.blockThresholdAmount ?? 0)
                .abs()
                .toString(),
            },
          },
          logger,
        );
      }

      await em.persistAndFlush(account);

      return [{}];
    },

    deleteAccount: async ({ request, em, logger }) => {
      // 检查当前是否有正在进行的同步账户用户操作
      await ensureNoRunningSyncTask(em, logger, "delete account task");

      const { accountName, tenantName, comment } = ensureNotUndefined(request, ["accountName", "tenantName"]);

      const tenant = await em.findOne(Tenant, { name: tenantName });

      if (!tenant) {
        throw { code: Status.NOT_FOUND, message: `Tenant ${tenantName} is not found.` } as ServiceError;
      }

      const account = await em.findOne(
        Account,
        {
          accountName,
          tenant: { name: tenantName },
        },
        { populate: ["tenant", "users", "users.user"] },
      );

      if (!account) {
        throw {
          code: Status.NOT_FOUND,
          message: `Account ${accountName} is not found`,
        } as ServiceError;
      }

      ensureAccountNotDeleted(account);

      const userAccounts = account.users.getItems();
      const currentActivatedClusters = await getActivatedClusters(em, logger);
      // 查询账户是否有RUNNING、PENDING的作业与交互式应用，有则抛出异常
      const fields = ["job_id", "user", "state", "account"];
      const runningJobs = await Promise.all(
        Object.entries(currentActivatedClusters).map(async ([cluster, clusterConfig]) => ({
          cluster,
          result: await server.ext.clusters.callOnOne(
            cluster,
            logger,
            async (client) =>
              await getSchedulerAdapterJobsByClusterFeatures(client, clusterConfig, {
                fields,
                filter: { users: [], accounts: [accountName], states: ["RUNNING", "PENDING"] },
              }),
          ),
        })),
      );

      const runningJobsObj = {
        accountName,
        type: "RUNNING_JOBS",
      };

      if (runningJobs.filter((i) => i.result.jobs.length > 0).length > 0) {
        throw {
          code: Status.FAILED_PRECONDITION,
          message: JSON.stringify(runningJobsObj),
        } as ServiceError;
      }

      // 处理用户账户关系表，删除账户与所有用户的关系
      const hasCapabilities = server.ext.capabilities.accountUserRelation;

      let ownerId;

      for (const userAccount of userAccounts) {
        const userId = userAccount.user.getEntity().userId;
        if (userAccount.role === EntityUserRole.OWNER) {
          ownerId = userId;
          continue;
        }
        await em.removeAndFlush(userAccount);
        await server.ext.clusters
          .callOnAll(currentActivatedClusters, logger, async (client) => {
            return await asyncClientCall(client.user, "removeUserFromAccount", { userId, accountName });
          })
          .catch(async (e) => {
            // 如果返回的所有 Error 都是 NOT_FOUND，说明这些集群均已将此用户移出账户，可以在 scow 数据库及认证系统中删除该条关系，
            // 除此以外，都抛出异常
            const errorCount = countSubstringOccurrences(e.details, "Error:");
            const notFoundErrorCount = countSubstringOccurrences(e.details, "Error: 5 NOT_FOUND");
            if (errorCount === 0 || errorCount !== notFoundErrorCount) {
              throw e;
            }
          });
        if (hasCapabilities) {
          await removeUserFromAccount(authUrl, { accountName, userId }, logger);
        }
      }

      if (account.whitelist) {
        em.remove(account.whitelist);
        account.whitelist = undefined;
      }

      // 先在数据库中删除，避免适配器不能在全部集群中删除账户（如默认账户）带来的一系列问题

      account.state = AccountState.DELETED;
      account.comment = account.comment + (comment ? "  " + comment.trim() : "");
      account.blockedInCluster = true;

      // 从目录服务用户组中移除账户下所有用户（不删除组本身）
      const groupService = await getGroupService(em, logger);
      const accountGroupName = account.accountGroupName;

      if (groupService && accountGroupName) {
        const deleteQuotaStateRecord = await em.findOne(SystemState, {
          key: SystemState.KEYS.ACCOUNT_STORAGE_QUOTA_STATE,
        });

        for (const userAccount of userAccounts) {
          const userId = userAccount.user.getEntity().userId;

          await resetPrimaryGroupIfNeeded(groupService, userId, accountGroupName, misConfig);
          await groupService.removeUserFromGroup(userId, accountGroupName);

          if (deleteQuotaStateRecord?.value === ACCOUNT_QUOTA_STATE.ENABLED) {
            await revertUserFileGroupToDefault(groupService, em, userId, ownerId!, misConfig, logger);
          }
        }
      }
      // 目录服务操作完，数据库才落库
      await em.flush();

      await callHook("accountDeleted", { accountName, comment, ownerId, tenantName }, logger);

      await server.ext.clusters
        .callOnAll(currentActivatedClusters, logger, async (client) => {
          return await asyncClientCall(client.account, "deleteAccount", { accountName });
        })
        .catch(async (e) => {
          // 如果返回的所有 Error 都是 NOT_FOUND，说明这些集群均已移出账户
          // 除此以外，都抛出异常
          const errorCount = countSubstringOccurrences(e.details, "Error:");
          const notFoundErrorCount = countSubstringOccurrences(e.details, "Error: 5 NOT_FOUND");
          if (errorCount === 0 || errorCount !== notFoundErrorCount) {
            logger.error(e, "deleteAccount Error occurred.");
            throw e;
          }
        });

      return [{}];
    },

    // 检查账户是否欠费
    isAccountBelowBlockThreshold: async ({ request, em }) => {
      const { accountName } = request;
      const account = await em.findOne(
        Account,
        {
          accountName,
        },
        {
          populate: ["tenant"],
        },
      );

      if (!account) {
        throw {
          code: Status.NOT_FOUND,
          message: `Account ${accountName} is not found`,
        } as ServiceError;
      }

      const thresholdAmount =
        account.blockThresholdAmount ?? account.tenant.getProperty("defaultAccountBlockThreshold");
      const state = getAccountStateInfo(
        account.whitelist?.id,
        account.state,
        account.balance,
        thresholdAmount,
      ).displayedState;

      if (state === Account_DisplayedAccountState.DISPLAYED_BELOW_BLOCK_THRESHOLD) {
        return [{ isBelowBlockThreshold: true }];
      } else {
        return [{ isBelowBlockThreshold: false }];
      }
    },
  });
});
