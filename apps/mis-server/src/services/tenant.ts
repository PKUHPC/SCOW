import { ConnectError } from "@connectrpc/connect";
import { ensureNotUndefined, plugin } from "@ddadaal/tsgrpc-server";
import { ServiceError, status } from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { raw, UniqueConstraintViolationException } from "@mikro-orm/core";
import { createUser } from "@scow/lib-auth";
import { Decimal, decimalToMoney, moneyToNumber } from "@scow/lib-decimal";
import { TenantServiceServer, TenantServiceService } from "@scow/protos/build/server/tenant";
import { blockAccount, unblockAccount } from "src/bl/block";
import { getActivatedClusters } from "src/bl/clustersUtils";
import { authUrl } from "src/config";
import { configClusters } from "src/config/clusters";
import { commonConfig } from "src/config/common";
import { Account } from "src/entities/Account";
import { Cluster } from "src/entities/Cluster";
import { Tenant } from "src/entities/Tenant";
import { TenantDefaultAppRemovedList } from "src/entities/TenantDefaultAppRemovedList";
import { TenantStorageQuota } from "src/entities/TenantStorageQuota";
import { TenantRole, User, UserState } from "src/entities/User";
import { UserAccount } from "src/entities/UserAccount";
import { callHook } from "src/plugins/hookClient";
import { getAccountStateInfo } from "src/utils/accountUserState";
import { getAiClusterAppConfigs, getClusterAppConfigs } from "src/utils/app";
import { createUserInDatabase, insertKeyToNewUser } from "src/utils/createUser";
import { getScowdClient } from "src/utils/scowd";
import { ensureNoRunningSyncTask } from "src/utils/synchronizationUtils";

export const tenantServiceServer = plugin((server) => {
  server.addService<TenantServiceServer>(TenantServiceService, {
    getTenantInfo: async ({ request, em }) => {
      const { tenantName } = request;

      const tenant = await em.findOne(Tenant, { name: tenantName });
      if (!tenant) {
        throw { code: status.NOT_FOUND, message: `Tenant ${tenantName} is not found.` } as ServiceError;
      }
      const accountCount = await em.count(Account, { tenant });
      const userCount = await em.count(User, { tenant });
      const admins = await em.find(
        User,
        { tenant, tenantRoles: { $like: `%${TenantRole.TENANT_ADMIN}%` } },
        {
          fields: ["userId", "name"],
        },
      );
      const financialStaff = await em.find(
        User,
        { tenant, tenantRoles: { $like: `%${TenantRole.TENANT_FINANCE}%` } },
        {
          fields: ["userId", "name"],
        },
      );

      return [
        {
          accountCount,
          admins: admins.map((a) => ({ userId: a.userId, userName: a.name })),
          userCount,
          balance: decimalToMoney(tenant.balance),
          defaultAccountBlockThreshold: decimalToMoney(tenant.defaultAccountBlockThreshold),
          financialStaff: financialStaff.map((f) => ({ userId: f.userId, userName: f.name })),
        },
      ];
    },

    getTenants: async ({ em }) => {
      const tenants = await em.find(Tenant, {}, { fields: ["name"] });

      return [{ names: tenants.map((x) => x.name) }];
    },

    getAllTenants: async ({ em }) => {
      const tenants = await em.find(Tenant, {});
      const userCountObjectArray: { tCount: number; tId: number }[] = await em
        .createQueryBuilder(User, "u")
        .select([raw("count(u.user_id) as tCount"), raw("u.tenant_id as tId")])
        .groupBy("u.tenant_id")
        .execute("all");
      // 将获查询得的对象数组userCountObjectArray转换为{"tenant_id":"userCountOfTenant"}形式
      const userCount = {};
      userCountObjectArray.map((x) => {
        userCount[x.tId] = x.tCount;
      });
      const accountCountObjectArray: { tCount: number; tId: number }[] = await em
        .createQueryBuilder(Account, "a")
        .select([raw("count(a.id) as tCount"), raw("a.tenant_id as tId")])
        .groupBy("a.tenant_id")
        .execute("all");
      // 将获查询得的对象数组accountCountObjectArray转换为{"tenant_id":"accountCountOfTenant"}形式
      const accountCount = {};
      accountCountObjectArray.map((x) => {
        accountCount[x.tId] = x.tCount;
      });
      return [
        {
          totalCount: tenants.length,
          platformTenants: tenants.map((x) => ({
            tenantId: x.id,
            tenantName: x.name,
            // 初始创建租户时，其中无账户和用户,
            userCount: userCount[`${x.id}`] ?? 0,
            accountCount: accountCount[`${x.id}`] ?? 0,
            balance: decimalToMoney(x.balance),
            createTime: x.createTime.toISOString(),
          })),
        },
      ];
    },

    createTenant: async ({ request, em, logger }) => {
      const { tenantName, userId, userName, userEmail, userPassword } = request;

      const tenant = await em.findOne(Tenant, { name: tenantName });
      if (tenant) {
        throw {
          code: Status.ALREADY_EXISTS,
          message: "The tenant already exists",
          details: "TENANT_ALREADY_EXISTS",
        } as ServiceError;
      }
      logger.info(`start to create tenant: ${tenantName} `);
      const newTenant = new Tenant({ name: tenantName });

      return await em.transactional(async (em) => {
        // 在数据库中创建租户
        await em.persistAndFlush(newTenant).catch((e) => {
          if (e instanceof UniqueConstraintViolationException) {
            throw {
              code: Status.ALREADY_EXISTS,
              message: "The tenant already exists",
              details: "TENANT_ALREADY_EXISTS",
            } as ServiceError;
          }
          throw { code: Status.INTERNAL, message: "Error creating tenant in database." } as ServiceError;
        });

        // 如果开启授权应用功能
        // 在所有集群下不添加应用到租户的默认授权应用
        if (commonConfig.allowAppAuthorization) {
          for (const [clusterId, config] of Object.entries(configClusters)) {
            // 如果集群开启了 AI 功能，在当前版本下默认为此集群为AI集群，获取AI集群下的交互式应用列表
            const clusterApps = config.ai?.enabled
              ? getAiClusterAppConfigs(clusterId)
              : getClusterAppConfigs(clusterId);

            const foundCluster = await em.findOne(Cluster, {
              clusterId: clusterId,
            });
            if (!foundCluster) {
              throw {
                code: Status.NOT_FOUND,
                message: `Cluster (ID: ${clusterId}) for authorizing application is not found`,
                details: "CLUSTER_NOT_FOUND",
              } as ServiceError;
            }

            for (const appId of Object.keys(clusterApps)) {
              const newItem = new TenantDefaultAppRemovedList({
                cluster: foundCluster,
                tenant: newTenant,
                appId: appId,
              });
              em.persist(newItem);
            }
          }

          await em.flush();
        }

        // 在数据库中创建user
        const user = await createUserInDatabase(userId, userName, userEmail, tenantName, logger, em)
          .then(async (user) => {
            user.tenantRoles = [TenantRole.TENANT_ADMIN];
            await em.persistAndFlush(user);
            return user;
          })
          .catch((e) => {
            if (e.code === Status.ALREADY_EXISTS) {
              throw {
                code: Status.ALREADY_EXISTS,
                message: `User with userId ${userId} already exists in scow.`,
                details: "USER_ALREADY_EXISTS",
              } as ServiceError;
            }
            throw {
              code: Status.INTERNAL,
              message: `Error creating user with userId ${userId} in database.`,
            } as ServiceError;
          });
        // call auth
        const createdInAuth = await createUser(
          authUrl,
          { identityId: user.userId, id: user.id, mail: user.email, name: user.name, password: userPassword },
          logger,
        )
          .then(async () => {
            // 插入公钥失败也认为是创建用户成功
            // 在所有集群下执行
            // 如果 SCOWD 开启则不需要插入公钥
            const filterClusterConfig = Object.fromEntries(
              Object.entries(configClusters).filter(([_, value]) => value.scowd?.enabled !== true),
            );

            await insertKeyToNewUser(userId, userPassword, logger, filterClusterConfig).catch(() => {});

            return true;
          })
          .then(async () => {
            // 设置用户的存储配额
            for (const [cluster, config] of Object.entries(configClusters)) {
              if (config.storage?.enabled && config.scowd?.enabled) {
                const tenantQuotas = await em.find(TenantStorageQuota, { tenant: user.tenant });
                const scowdClient = getScowdClient(cluster, userId);

                const quotaBytes = tenantQuotas.find((quota) => quota.cluster === cluster)?.userDefaultQuota;
                if (quotaBytes === undefined) {
                  const totalStorageBytes = (
                    await scowdClient.storageQuota.getFilesystemStorageUsage({
                      path: config.storage.paths[0],
                    })
                  ).totalStorageBytes;

                  await scowdClient.storageQuota.setUserStorageQuota({
                    userId,
                    path: config.storage.paths[0],
                    quotaBytes: totalStorageBytes,
                  });
                } else {
                  await scowdClient.storageQuota.setUserStorageQuota({
                    userId,
                    path: config.storage.paths[0],
                    quotaBytes: BigInt(quotaBytes),
                  });
                }
              }
            }

            return true;
          })
          .catch(async (e) => {
            if (e.status === 409) {
              logger.warn("User exists in auth.");
              return false;
            } else if (e instanceof ConnectError) {
              server.logger.error("Failed to set user storage quota.", e);
              throw {
                code: Status.INTERNAL,
                message: `Failed to set user ${userId} storage quota.`,
              } as ServiceError;
            } else {
              logger.error("Error creating user in auth.", e);
              throw {
                code: Status.INTERNAL,
                message: `Error creating user with userId ${userId} in auth.`,
              } as ServiceError;
            }
          });
        await callHook("userCreated", { tenantName, userId: user.userId }, logger);
        return [{ tenantId: newTenant.id, userId: user.id, createdInAuth: createdInAuth }];
      });
    },

    setDefaultAccountBlockThreshold: async ({ request, em, logger }) => {
      // 检查当前是否有正在执行的同步用户账户操作
      await ensureNoRunningSyncTask(em, logger, "set tenant block threshold task");

      const { tenantName, blockThresholdAmount } = ensureNotUndefined(request, ["blockThresholdAmount"]);
      const tenant = await em.findOne(Tenant, { name: tenantName });

      if (!tenant) {
        throw { code: status.NOT_FOUND, message: `Tenant ${tenantName} is not found.` } as ServiceError;
      }
      tenant.defaultAccountBlockThreshold = new Decimal(moneyToNumber(blockThresholdAmount));

      // 判断租户下各账户是否使用该租户封锁阈值，使用后是否需要在集群中进行封锁
      const accounts = await em.find(
        Account,
        { tenant: tenant, blockThresholdAmount: undefined },
        {
          populate: ["tenant"],
        },
      );

      const blockedAccounts: string[] = [];
      const blockedFailedAccounts: string[] = [];
      const unBlockedAccounts: string[] = [];
      const unBlockedFailedAccounts: string[] = [];

      const currentActivatedClusters = await getActivatedClusters(em, logger);
      if (accounts.length > 0) {
        await Promise.allSettled(
          accounts.map(async (account) => {
            // 判断设置封锁阈值后是否应该在集群中封锁
            const shouldBlockInCluster = getAccountStateInfo(
              account.whitelist?.id,
              account.state,
              account.balance,
              new Decimal(moneyToNumber(blockThresholdAmount)),
            ).shouldBlockInCluster;

            if (shouldBlockInCluster) {
              logger.info(
                "Account %s may be out of balance when using default tenant block threshold amount. " +
                  "Block the account.",
                account.accountName,
              );

              try {
                await blockAccount(account, currentActivatedClusters, server.ext.clusters, logger);
                blockedAccounts.push(account.accountName);
              } catch (error) {
                logger.warn("Failed to block account %s in slurm: %o", account.accountName, error);
                blockedFailedAccounts.push(account.accountName);
              }
            }

            if (!shouldBlockInCluster) {
              logger.info(
                "The balance of Account %s is greater than the default tenant block threshold amount. " +
                  "Unblock the account.",
                account.accountName,
              );

              try {
                await unblockAccount(
                  account,
                  currentActivatedClusters,
                  server.ext.clusters,
                  logger,
                  server.ext.resource,
                );
                unBlockedAccounts.push(account.accountName);
              } catch (error) {
                logger.warn("Failed to unBlock account %s in slurm: %o", account.accountName, error);
                unBlockedFailedAccounts.push(account.accountName);
              }
            }
          }),
        ).catch((e) => {
          logger.error("Block or unblock account failed when set a new default tenant threshold amount.", e);
        });
      }

      logger.info("Updated block status in slurm of the following accounts: %o", blockedAccounts);
      logger.info("Updated block status failed in slurm of the following accounts: %o", blockedFailedAccounts);

      logger.info("Updated unBlock status in slurm of the following accounts: %o", unBlockedAccounts);
      logger.info("Updated unBlock status failed in slurm of the following accounts: %o", unBlockedFailedAccounts);

      if (accounts.length > 0) {
        await em.persistAndFlush([...accounts, tenant]);
      } else {
        await em.persistAndFlush(tenant);
      }

      return [{}];
    },

    createTenantWithExistingUserAsAdmin: async ({ request, em }) => {
      const { tenantName, userId, userName } = request;

      const tenant = await em.findOne(Tenant, { name: tenantName });
      if (tenant) {
        throw {
          code: Status.ALREADY_EXISTS,
          message: "The tenant already exists",
          details: "TENANT_ALREADY_EXISTS",
        } as ServiceError;
      }

      const newTenant = new Tenant({ name: tenantName });

      const user = await em.findOne(User, { userId, name: userName });

      if (!user || user.state === UserState.DELETED) {
        throw {
          code: Status.NOT_FOUND,
          message: `User with userId ${userId} and name ${userName}
          is either not found or has been deleted.`,
        } as ServiceError;
      }

      if (user.tenantRoles.length) {
        throw {
          code: Status.FAILED_PRECONDITION,
          message: `User ${userId} still maintains tenant roles.`,
          details: "USER_STILL_MAINTAINS_TENANT_ROLES",
        } as ServiceError;
      }

      const userAccount = await em.findOne(UserAccount, { user: user });

      if (userAccount) {
        throw {
          code: Status.FAILED_PRECONDITION,
          message: `User ${userId} still maintains account relationship.`,
          details: "USER_STILL_MAINTAINS_ACCOUNT_RELATIONSHIP",
        } as ServiceError;
      }

      // 修改该用户的租户， 并且作为租户管理员
      em.assign(user, { tenant: newTenant });
      user.tenantRoles = [TenantRole.TENANT_ADMIN];

      await em.persistAndFlush([user, newTenant]);

      return [
        {
          tenantName: newTenant.name,
          adminUserId: user.userId,
        },
      ];
    },
  });
});
