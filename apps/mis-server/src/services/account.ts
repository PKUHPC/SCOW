/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { plugin } from "@ddadaal/tsgrpc-server";
import { ServiceError } from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { LockMode, UniqueConstraintViolationException } from "@mikro-orm/core";
import { createAccount } from "@scow/lib-auth";
import { Decimal, decimalToMoney, moneyToNumber } from "@scow/lib-decimal";
import { getAccountSpecifiedPartitions, libCheckActivatedClusters } from "@scow/lib-server";
import { account_AccountStateFromJSON, AccountServiceServer, AccountServiceService,
  BlockAccountResponse_Result } from "@scow/protos/build/server/account";
import { blockAccount, unblockAccount } from "src/bl/block";
import { getActivatedClusters } from "src/bl/clustersUtils";
import { authUrl } from "src/config";
import { commonConfig } from "src/config/common";
import { Account, AccountState } from "src/entities/Account";
import { AccountWhitelist } from "src/entities/AccountWhitelist";
import { Tenant } from "src/entities/Tenant";
import { User } from "src/entities/User";
import { UserAccount, UserRole as EntityUserRole, UserStatus } from "src/entities/UserAccount";
import { callHook } from "src/plugins/hookClient";
import { getAccountStateInfo } from "src/utils/accountUserState";
import { toRef } from "src/utils/orm";

export const accountServiceServer = plugin((server) => {

  server.addService<AccountServiceServer>(AccountServiceService, {
    blockAccount: async ({ request, em, logger }) => {
      const { accountName, unassignedClusterPartition } = request;

      // 当 unassignedClusterPartition 的值存在时，代表需要在某一分区中取消对账户的授权
      // 当前只应用在资源分区管理的扩展功能中
      if (unassignedClusterPartition) {
        return await em.transactional(async (em) => {
          const account = await em.findOne(Account, {
            accountName,
          }, { lockMode: LockMode.PESSIMISTIC_WRITE, populate: ["tenant"]});

          if (!account) {
            throw <ServiceError>{
              code: Status.NOT_FOUND, message: `Account ${accountName} is not found`,
            };
          }

          // 确认当前需要取消授权分区的集群是否可用
          const currentActivatedClusters = await getActivatedClusters(em, logger);
          libCheckActivatedClusters({ clusterIds: unassignedClusterPartition.clusterId,
            activatedClusters: currentActivatedClusters, logger });

          // 如果有正在运行的作业暂时不允许取消授权
          const jobsResp = await server.ext.clusters.callOnOne(
            unassignedClusterPartition.clusterId,
            logger,
            async (client) => {
              const fields = [
                "job_id", "user", "state", "account",
              ];

              return await asyncClientCall(client.job, "getJobs", {
                fields,
                filter: { users: [], accounts: [accountName], states: ["RUNNING", "PENDING"]},
              });
            },
          );

          if (jobsResp.jobs.length > 0) {
            throw <ServiceError>{
              code: Status.FAILED_PRECONDITION,
              message: `Account ${accountName}  has jobs running and cannot be unassigned. `,
            };
          }

          // 直接对指定分区进行封锁，但是不更改scow中的任何数据
          await server.ext.clusters.callOnOne(
            unassignedClusterPartition.clusterId, logger, async (client) => {
              await asyncClientCall(client.account, "blockAccount", {
                accountName: account.accountName,
                blockedPartitions: [ unassignedClusterPartition.partition ],
              });
            });

          return [{ result: BlockAccountResponse_Result.OK }];
        });
      }


      return await em.transactional(async (em) => {
        const account = await em.findOne(Account, {
          accountName,
        }, { lockMode: LockMode.PESSIMISTIC_WRITE, populate: ["tenant"]});

        if (!account) {
          throw <ServiceError>{
            code: Status.NOT_FOUND, message: `Account ${accountName} is not found`,
          };
        }

        const currentActivatedClusters = await getActivatedClusters(em, logger);
        const jobs = await server.ext.clusters.callOnAll(
          currentActivatedClusters,
          logger,
          async (client) => {
            const fields = [
              "job_id", "user", "state", "account",
            ];

            return await asyncClientCall(client.job, "getJobs", {
              fields,
              filter: { users: [], accounts: [accountName], states: ["RUNNING", "PENDING"]},
            });
          },
        );

        if (jobs.filter((i) => i.result.jobs.length > 0).length > 0) {
          throw <ServiceError>{
            code: Status.FAILED_PRECONDITION,
            message: `Account ${accountName}  has jobs running and cannot be blocked. `,
          };
        }

        const blockThresholdAmount =
        account.blockThresholdAmount ?? account.tenant.$.defaultAccountBlockThreshold;

        const result = await blockAccount(account,
          currentActivatedClusters,
          server.ext.clusters, logger);

        if (result === "AlreadyBlocked") {

          // 如果账户已被手动冻结，提示账户已被冻结
          // 当前scow暂未使用AccountState.FROZEN
          if (account.state === AccountState.FROZEN) {
            throw <ServiceError>{
              code: Status.FAILED_PRECONDITION,
              message: `Account ${accountName} has been frozen. `,
            };
          }

          // 如果是未欠费（余额大于封锁阈值）账户，提示账户已被封锁
          if (account.balance.gt(blockThresholdAmount)) {
            throw <ServiceError>{
              code: Status.FAILED_PRECONDITION,
              message: `Account ${accountName} has been blocked. `,
            };
          }
        }

        if (result === "Whitelisted") {
          throw <ServiceError>{
            code: Status.FAILED_PRECONDITION,
            message: `The account ${accountName} has been added to the whitelist. `,
          };
        }

        // 更改数据库中状态值
        account.state = AccountState.BLOCKED_BY_ADMIN;

        return [{ result: BlockAccountResponse_Result.OK }];
      });
    },

    unblockAccount: async ({ request, em, logger }) => {
      const { accountName } = request;

      return await em.transactional(async (em) => {
        const account = await em.findOne(Account, {
          accountName,
        }, { lockMode: LockMode.PESSIMISTIC_WRITE, populate: [ "tenant"]});

        if (!account) {
          throw <ServiceError>{
            code: Status.NOT_FOUND, message: `Account ${accountName} is not found`,
          };
        }

        if (!account.blockedInCluster) {
          throw <ServiceError>{
            code: Status.FAILED_PRECONDITION, message: `Account ${accountName} is unblocked`,
          };
        }
        // 将账户从被上级封锁或冻结状态变更为正常
        account.state = AccountState.NORMAL;

        const blockThresholdAmount =
        account.blockThresholdAmount ?? account.tenant.$.defaultAccountBlockThreshold;

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
          return [{ executed: true }];
        }

        const currentActivatedClusters = await getActivatedClusters(em, logger);
        await unblockAccount(account, currentActivatedClusters, server.ext.clusters, logger);

        return [{ executed: true }];

      });
    },

    getAccounts: async ({ request, em }) => {

      const { accountName, tenantName } = request;

      const results = await em.find(Account, {
        ...tenantName !== undefined ? { tenant: { name: tenantName } } : undefined,
        ...accountName !== undefined ? { accountName } : undefined,
      }, { populate: ["users", "users.user", "tenant"]});

      return [{
        results: results.map((x) => {

          const owner = x.users.getItems().find((x) => x.role === EntityUserRole.OWNER);

          if (!owner) {
            throw <ServiceError>{
              code: Status.INTERNAL, message: `Account ${x.accountName} does not have an owner`,
            };
          }

          const ownerUser = owner.user.getEntity();
          const thresholdAmount = x.blockThresholdAmount ?? x.tenant.$.defaultAccountBlockThreshold;
          const displayedAccountState =
            getAccountStateInfo(x.whitelist?.id, x.state, x.balance, thresholdAmount).displayedState;

          return {
            accountName: x.accountName,
            tenantName: x.tenant.$.name,
            userCount: x.users.count(),
            blocked: Boolean(x.blockedInCluster),
            state: account_AccountStateFromJSON(x.state),
            displayedState: displayedAccountState,
            isInWhitelist: Boolean(!!x.whitelist?.id),
            ownerId: ownerUser.userId,
            ownerName: ownerUser.name,
            comment: x.comment,
            balance: decimalToMoney(x.balance),
            blockThresholdAmount: x.blockThresholdAmount
              ? decimalToMoney(x.blockThresholdAmount)
              : undefined,
            defaultBlockThresholdAmount: decimalToMoney(x.tenant.$.defaultAccountBlockThreshold),
          };
        }),
      }];
    },

    createAccount: async ({ request, em, logger }) => {
      const { accountName, tenantName, ownerId, comment } = request;
      const user = await em.findOne(User, { userId: ownerId, tenant: { name: tenantName } });

      if (!user) {
        throw <ServiceError> {
          code: Status.NOT_FOUND, message: `User ${user} under tenant ${tenantName} does not exist`,
        };
      }

      const tenant = await em.findOne(Tenant, { name: tenantName });
      if (!tenant) {
        throw <ServiceError> {
          code: Status.NOT_FOUND, message: `Tenant ${tenantName} is not found`,
        };
      }

      // 新建账户时比较租户默认封锁阈值，如果租户默认封锁阈值小于0则保持账户为在集群中可用状态
      // 如果租户默认封锁阈值大于等于0，则封锁账户
      const shouldBlockInCluster: boolean = tenant.defaultAccountBlockThreshold.gte(0);

      // insert the account now to avoid future conflict
      const account = new Account({ accountName, comment, tenant, blockedInCluster: shouldBlockInCluster });

      const userAccount = new UserAccount({
        account, user, role: EntityUserRole.OWNER, blockedInCluster: UserStatus.UNBLOCKED,
      });

      try {
        await em.persistAndFlush([account, userAccount]);
      } catch (e) {
        if (e instanceof UniqueConstraintViolationException) {
          throw <ServiceError>{
            code: Status.ALREADY_EXISTS, message: `Account ${accountName} already exists.`,
          };
        }
      }

      const rollback = async (e: any) => {
        logger.info("Rollback account creation of %s", accountName);
        await em.removeAndFlush([account, userAccount]);
        throw e;
      };

      const currentActivatedClusters = await getActivatedClusters(em, logger);
      logger.info("Creating account in cluster.");
      await server.ext.clusters.callOnAll(
        currentActivatedClusters,
        logger,
        async (client, cluster) => {
          await asyncClientCall(client.account, "createAccount", {
            accountName, ownerUserId: ownerId,
          });

          const assignedPartitions = await getAccountSpecifiedPartitions(
            cluster,
            account.accountName,
            commonConfig.scowResourceManagement,
            logger,
            server.ext.partitions?.getAssignedPartitions,
          );

          // 判断为需在集群中封锁时
          if (shouldBlockInCluster) {

            await asyncClientCall(client.account, "blockAccount", {
              accountName,
              blockedPartitions: [],
            }).catch((e) => {
              if (e.code === Status.NOT_FOUND) {
                throw <ServiceError>{
                  code: Status.INTERNAL, message: `Account ${accountName} hasn't been created. Block failed`,
                };
              } else {
                throw e;
              }
            });
          // 判断为需在集群中解封时
          } else {

            if (assignedPartitions && assignedPartitions.length === 0) {
              // 已部署资源分区管理但是实际创建账户时没有授权分区时
              // 实行一次封锁确保未来不产生冲突，代表账户没有授权分区
              await asyncClientCall(client.account, "blockAccount", {
                accountName,
                blockedPartitions: [],
              }).catch((e) => {
                if (e.code === Status.NOT_FOUND) {
                  throw <ServiceError>{
                    code: Status.INTERNAL, message: `Account ${accountName} hasn't been created.`,
                  };
                } else {
                  throw e;
                }
              });

            } else {
              await asyncClientCall(client.account, "unblockAccount", {
                accountName,
                unblockedPartitions: assignedPartitions ?? [],
              }).catch((e) => {
                if (e.code === Status.NOT_FOUND) {
                  throw <ServiceError>{
                    code: Status.INTERNAL, message: `Account ${accountName} hasn't been created. Unblock failed`,
                  };
                } else {
                  throw e;
                }
              });
            }


          }

        },
      ).catch(async (e) => {
        await rollback(e);
        throw e;
      });

      logger.info("Account has been created in cluster.");

      await callHook("accountCreated", { accountName, comment, ownerId, tenantName }, logger);

      if (server.ext.capabilities.accountUserRelation) {
        await createAccount(authUrl, { accountName, ownerUserId: ownerId }, logger);
      }

      return [{}];
    },

    getWhitelistedAccounts: async ({ request, em }) => {

      const { tenantName } = request;

      // 删除过期的白名单账户
      const today = new Date();

      // 查询所有相关信息，并删除过期的白名单账户
      const results = await em.find(AccountWhitelist, {
        $and: [
          { account: { tenant: { name: tenantName } } },
        ],
      }, {
        populate: ["account"],
      });

      // 删除过期的白名单账户
      const expiredWhitelists = results.filter((x) => x.expirationTime && x.expirationTime < today);
      if (expiredWhitelists.length > 0) {
        await em.removeAndFlush(expiredWhitelists);
      }

      const owners = await em.find(UserAccount, {
        account: { accountName: results.map((x) => x.account.$.accountName), tenant: { name: tenantName } },
        role: EntityUserRole.OWNER,
      }, { populate: ["user"]});

      // 过滤结果，排除已删除的白名单账户
      const validResults = results.filter((x) => !expiredWhitelists.includes(x));

      return [{
        accounts: validResults.map((x) => {

          const accountOwner = owners.find((o) => o.account.id === x.account.id)!.user.$;
          return {
            accountName: x.account.$.accountName,
            comment: x.comment,
            operatorId: x.operatorId,
            addTime: x.time.toISOString(),
            ownerId: accountOwner.userId + "",
            ownerName: accountOwner.name,
            balance: decimalToMoney(x.account.$.balance),
            expirationTime:x.expirationTime?.toISOString().includes("2099") ? undefined
              : x.expirationTime?.toISOString(),
          };

        }),
      }];
    },

    whitelistAccount: async ({ request, em, logger }) => {
      const { accountName, comment, operatorId, tenantName, expirationTime } = request;

      const account = await em.findOne(Account, { accountName, tenant: { name: tenantName } },
        { populate: [ "tenant"]});

      if (!account) {
        throw <ServiceError>{
          code: Status.NOT_FOUND, message: `Account ${accountName} is not found`,
        };
      }

      if (account.whitelist) {
        return [{ executed: false }];
      }

      const whitelist = new AccountWhitelist({
        account,
        time: new Date(),
        comment,
        operatorId,
        // expirationTime为undefined时为永久有效
        expirationTime:expirationTime ? new Date(expirationTime) : undefined,
      });
      account.whitelist = toRef(whitelist);

      // 如果移入白名单之前账户状态为冻结，则冻结状态优先级高于白名单，账户在集群中仍为封锁状态，state值不变
      if (account.state === AccountState.FROZEN) {
        logger.info("Add account %s to whitelist by %s with comment %s, but the account is still frozen",
          accountName,
          operatorId,
          comment,
        );
      // 如果移入白名单之前账户状态不为冻结，则账户状态变更为正常，账户在集群中为解封状态
      } else {
        account.state = AccountState.NORMAL;
        const currentActivatedClusters = await getActivatedClusters(em, logger);
        await unblockAccount(account, currentActivatedClusters, server.ext.clusters, logger);
      }

      await em.persistAndFlush(whitelist);

      logger.info("Add account %s to whitelist by %s with comment %s",
        accountName,
        operatorId,
        comment,
      );

      return [{ executed: true }];
    },

    dewhitelistAccount: async ({ request, em, logger }) => {
      const { accountName, tenantName } = request;

      const account = await em.findOne(Account, { accountName, tenant: { name: tenantName } }, { populate: ["tenant"]});

      if (!account) {
        throw <ServiceError>{
          code: Status.NOT_FOUND, message: `Account ${accountName} is not found`,
        };
      }
      if (!account.whitelist) {
        return [{ executed: false }];
      }

      em.remove(account.whitelist);
      account.whitelist = undefined;

      logger.info("Remove account %s from whitelist",
        accountName,
      );

      const blockThresholdAmount =
      account.blockThresholdAmount ?? account.tenant.$.defaultAccountBlockThreshold;

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
        await blockAccount(account, currentActivatedClusters, server.ext.clusters, logger);
      }

      await em.flush();

      return [{ executed: true }];
    },

    setBlockThreshold: async ({ request, em, logger }) => {
      const { accountName, blockThresholdAmount } = request;

      const account = await em.findOne(Account, { accountName }, {
        populate: ["tenant"],
      });

      if (!account) {
        throw <ServiceError>{
          code: Status.NOT_FOUND, message: `Account ${accountName} is not found`,
        };
      }
      account.blockThresholdAmount = blockThresholdAmount
        ? new Decimal(moneyToNumber(blockThresholdAmount))
        : undefined;

      const currentBlockThreshold = blockThresholdAmount ?
        new Decimal(moneyToNumber(blockThresholdAmount)) :
        account.tenant.getProperty("defaultAccountBlockThreshold");

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
        await blockAccount(account, currentActivatedClusters, server.ext.clusters, logger);
      }

      if (!shouldBlockInCluster) {
        logger.info("The balance of Account %s is greater than the block threshold amount. "
        + "Unblock the account.", account.accountName);
        await unblockAccount(account, currentActivatedClusters, server.ext.clusters, logger);
      }

      await em.persistAndFlush(account);

      return [{}];
    },
  });

});
