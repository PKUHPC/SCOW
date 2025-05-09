import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ensureNotUndefined, plugin } from "@ddadaal/tsgrpc-server";
import { ServiceError } from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { QueryOrder, raw } from "@mikro-orm/core";
import { addUserToAccount, changeEmail as libChangeEmail, createUser, deleteUser,
  getCapabilities, getUser, HttpError,
  removeUserFromAccount,
}
  from "@scow/lib-auth";
import { decimalToMoney } from "@scow/lib-decimal";
import { checkSchedulerApiVersion } from "@scow/lib-server";
import { checkTimeZone, convertToDateMessage } from "@scow/lib-server/build/date";
import {
  AccountState as PFAccountState, AccountStatus,
  accountUserInfo_UserStateInAccountFromJSON, GetAccountUsersResponse,
  platformRoleFromJSON,
  platformRoleToJSON,
  QueryIsUserInAccountResponse,
  tenantRoleFromJSON,
  tenantRoleToJSON,
  UserRole as PFUserRole, UserServiceServer,
  UserServiceService,
  userStateFromJSON,
  UserStatus as PFUserStatus } from "@scow/protos/build/server/user";
import { ApiVersion } from "@scow/utils/build/version";
import { blockUserInAccount, unblockUserInAccount } from "src/bl/block";
import { getActivatedClusters } from "src/bl/clustersUtils";
import { authUrl } from "src/config";
import { configClusters } from "src/config/clusters";
import { misConfig } from "src/config/mis";
import { Account,AccountState } from "src/entities/Account";
import { Tenant } from "src/entities/Tenant";
import { PlatformRole, TenantRole, User, UserState } from "src/entities/User";
import { UserAccount, UserRole, UserStateInAccount, UserStatus } from "src/entities/UserAccount";
import { callHook } from "src/plugins/hookClient";
import { getUserStateInfo } from "src/utils/accountUserState";
import { countSubstringOccurrences } from "src/utils/countSubstringOccurrences";
import { createUserInDatabase, insertKeyToNewUser } from "src/utils/createUser";
import { generateAllUsersQueryOptions } from "src/utils/queryOptions";


export const userServiceServer = plugin((server) => {

  server.addService<UserServiceServer>(UserServiceService, {
    getAccountUsers: async ({ request, em }) => {
      const { accountName, tenantName } = request;

      const accountUsers = await em.find(UserAccount, {
        account: { accountName, tenant: { name: tenantName } },
      }, { populate: ["user", "user.storageQuotas"]});

      return [GetAccountUsersResponse.fromPartial({
        results: accountUsers.map((x) => {

          const displayedState = x.state ?
            getUserStateInfo(x.state, x.jobChargeLimit, x.usedJobCharge).displayedState : undefined;
          return {
            userId: x.user.$.userId,
            name: x.user.$.name,
            email: x.user.$.email,
            role: PFUserRole[x.role],
            status: PFUserStatus[x.blockedInCluster],
            jobChargeLimit: x.jobChargeLimit ? decimalToMoney(x.jobChargeLimit) : undefined,
            usedJobChargeLimit: x.usedJobCharge ? decimalToMoney(x.usedJobCharge) : undefined,
            storageQuotas: x.user.$.storageQuotas.getItems().reduce((prev, curr) => {
              prev[curr.cluster] = curr.storageQuota;
              return prev;
            }, {}),
            userStateInAccount: accountUserInfo_UserStateInAccountFromJSON(x.state),
            displayedUserState: displayedState,
          };
        },
        ),
      })];
    },

    queryIsUserInAccount: async ({ request, em }) => {
      const { accountName, userId, tenantName } = request;

      const user = await em.findOne(UserAccount, {
        user: { userId, tenant: { name: tenantName } },
        account: { accountName, tenant: { name: tenantName } },
      });

      return [QueryIsUserInAccountResponse.fromPartial({
        result: user !== null,
      })];
    },

    getUserStatus: async ({ request, em }) => {
      const { userId, tenantName } = request;

      const user = await em.findOne(User, { userId, tenant: { name: tenantName } }, {
        populate: ["storageQuotas", "accounts", "accounts.account"],
      });

      if (!user) {
        throw {
          code: Status.NOT_FOUND, message: `User ${userId}, tenant ${tenantName} is not found`,
        } as ServiceError;
      }

      const tenant = await em.findOne(Tenant, { name: tenantName });
      if (!tenant) {
        throw { code:Status.NOT_FOUND, message: `Tenant ${tenantName} is not found.` } as ServiceError;
      }
      const accountStatuses = user.accounts.getItems().reduce((prev, curr) => {
        const account = curr.account.getEntity();
        prev[account.accountName] = {
          accountBlocked: Boolean(account.blockedInCluster),
          userStatus: PFUserStatus[curr.blockedInCluster],
          jobChargeLimit: curr.jobChargeLimit ? decimalToMoney(curr.jobChargeLimit) : undefined,
          usedJobCharge: curr.usedJobCharge ? decimalToMoney(curr.usedJobCharge) : undefined,
          balance: decimalToMoney(curr.account.getEntity().balance),
          isInWhitelist: Boolean(account.whitelist),
          blockThresholdAmount:account.blockThresholdAmount ?
            decimalToMoney(account.blockThresholdAmount) : decimalToMoney(tenant.defaultAccountBlockThreshold),
          accountState:PFAccountState["ACCOUNT_" + account.state],
        } as AccountStatus;
        return prev;
      }, {});

      const storageQuotas = user.storageQuotas.getItems().reduce((prev, curr) => {
        prev[curr.cluster] = curr.storageQuota;
        return prev;
      }, {});

      return [{
        accountStatuses,
        storageQuotas,
      }];
    },

    queryUsedStorageQuota: async () => {
      // const { cluster, userId } = request;

      // const reply = await server.ext.clusters.callOnOne(
      //   cluster,
      //   logger,
      //   async (ops) => ops.storage.queryUsedStorageQuota({
      //     request: { userId }, logger,
      //   }),
      // );

      // if (reply.code === "NOT_FOUND") {
      //   throw <ServiceError>{
      //     code: Status.NOT_FOUND, message: `User ${userId}  is not found.`,
      //   };
      // }

      return [{
        used: 10,
      }];
    },

    addUserToAccount: async ({ request, em, logger }) => {
      const { accountName, userId, tenantName,isTenantAdmin } = request;

      const account = await em.findOne(Account, {
        accountName, tenant: { name: tenantName },
      }, { populate: ["users", "users.user", "tenant"]});

      const user = await em.findOne(User, {
        userId, tenant: { name: tenantName },
      });

      if (!user) {
        throw {
          code: Status.NOT_FOUND,
          message: `User ${userId} or tenant ${tenantName} is not found.`,
          details:"USER_OR_TENANT_NOT_FOUND",
        } as ServiceError;
      }

      if (!account) {
        throw {
          code: Status.NOT_FOUND,
          message: `Account ${accountName} or tenant ${tenantName} is not found.`,
          details:"ACCOUNT_OR_TENANT_NOT_FOUND",
        } as ServiceError;
      }

      // 如果账户是被封锁的状态且用户不是租户管理员，报错
      if (account.state === AccountState.BLOCKED_BY_ADMIN && !isTenantAdmin) {
        throw {
          code: Status.NOT_FOUND,
          details: "ACCOUNT_BLOCKED_BY_ADMIN",
        } as ServiceError;
      }

      if (user.state === UserState.DELETED) {
        throw {
          code: Status.NOT_FOUND,
          details: "USER_DELETED",
        } as ServiceError;
      }

      if (account.state === AccountState.DELETED) {
        throw {
          code: Status.NOT_FOUND,
          details: "ACCOUNT_DELETED",
        } as ServiceError;
      }

      if (account.users.getItems().some((x) => x.user.getEntity().userId === userId)) {
        throw {
          code: Status.ALREADY_EXISTS, message: `User ${userId} already in the account ${accountName}.`,
        } as ServiceError;
      }

      const currentActivatedClusters = await getActivatedClusters(em, logger);

      await server.ext.clusters.callOnAll(currentActivatedClusters, logger, async (client) => {
        return await asyncClientCall(client.user, "addUserToAccount", { userId, accountName });
      }).catch(async (e) => {
        // 如果每个适配器返回的Error都是ALREADY_EXISTS，说明所有集群均已添加成功，可以在scow数据库及认证系统中加入该条关系，
        // 除此以外，都抛出异常
        if (countSubstringOccurrences(e.details, "Error: 6 ALREADY_EXISTS")
           !== Object.keys(currentActivatedClusters).length) {
          throw e;
        }
      });

      const newUserAccount = new UserAccount({
        account,
        user,
        role: UserRole.USER,
        blockedInCluster: UserStatus.UNBLOCKED,
      });

      account.users.add(newUserAccount);

      await em.persistAndFlush([account, user, newUserAccount]);

      if (server.ext.capabilities.accountUserRelation) {
        await addUserToAccount(authUrl, { accountName, userId }, logger);
      }

      return [{}];
    },

    removeUserFromAccount: async ({ request, em, logger }) => {
      const { accountName, userId, tenantName } = request;

      const userAccount = await em.findOne(UserAccount, {
        user: { userId, tenant: { name: tenantName } },
        account: { accountName, tenant: { name: tenantName } },
      }, { populate: ["user", "account"]});

      if (!userAccount) {
        throw {
          code: Status.NOT_FOUND, message:`User ${userId} or account ${accountName}  is not found.`,
        } as ServiceError;
      }

      if (userAccount.role === UserRole.OWNER) {
        throw {
          code: Status.OUT_OF_RANGE,
          message: `User ${userId} is the owner of the account ${accountName}。`,
        } as ServiceError;
      }

      const currentActivatedClusters = await getActivatedClusters(em, logger);
      // 如果要从账户中移出用户，先封锁，先将用户封锁，保证用户无法提交作业
      if (userAccount.blockedInCluster === UserStatus.UNBLOCKED) {
        userAccount.state = UserStateInAccount.BLOCKED_BY_ADMIN;
        await blockUserInAccount(userAccount, currentActivatedClusters, server.ext, logger);
        await em.flush();
      }

      // 查询用户是否有RUNNING、PENDING的作业，如果有，抛出异常
      const jobs = await server.ext.clusters.callOnAll(
        currentActivatedClusters,
        logger,
        async (client) => {
          const fields = ["job_id", "user", "state", "account"];

          return await asyncClientCall(client.job, "getJobs", {
            fields,
            filter: { users: [userId], accounts: [accountName], states: ["RUNNING", "PENDING"]},
          });
        },
      );

      if (jobs.filter((i) => i.result.jobs.length > 0).length > 0) {
        throw {
          code: Status.FAILED_PRECONDITION,
          message: `User ${userId} has jobs running or pending and cannot remove.
          Please wait for the job to end or end the job manually before moving out.`,
        } as ServiceError;
      }


      await server.ext.clusters.callOnAll(currentActivatedClusters, logger, async (client) => {
        return await asyncClientCall(client.user, "removeUserFromAccount", { userId, accountName });
      }).catch(async (e) => {
        // 如果每个适配器返回的Error都是NOT_FOUND，说明所有集群均已将此用户移出账户，可以在scow数据库及认证系统中删除该条关系，
        // 除此以外，都抛出异常
        if (countSubstringOccurrences(e.details, "Error: 5 NOT_FOUND")
           !== Object.keys(currentActivatedClusters).length) {
          throw e;
        }
      });

      await em.removeAndFlush(userAccount);

      if (server.ext.capabilities.accountUserRelation) {
        await removeUserFromAccount(authUrl, { accountName, userId }, logger);
      }

      return [{}];

    },

    blockUserInAccount: async ({ request, em, logger }) => {
      const { accountName, userId, tenantName } = request;

      const user = await em.findOne(UserAccount, {
        user: { userId, tenant: { name: tenantName } },
        account: { accountName, tenant: { name: tenantName } },
      }, { populate: ["user", "account"]});

      if (!user) {
        throw {
          code: Status.NOT_FOUND, message: `User ${userId} or account ${accountName} is not found.`,
        } as ServiceError;
      }

      // 如果已经在集群下为封锁，且状态值为被账户管理员或拥有者手动封锁
      if (user.blockedInCluster === UserStatus.BLOCKED && user.state === UserStateInAccount.BLOCKED_BY_ADMIN) {
        throw {
          code: Status.FAILED_PRECONDITION, message: `User ${userId}  is already blocked.`,
        } as ServiceError;
      }

      const currentActivatedClusters = await getActivatedClusters(em, logger);
      await blockUserInAccount(user, currentActivatedClusters, server.ext, logger);
      user.state = UserStateInAccount.BLOCKED_BY_ADMIN;
      user.blockedInCluster = UserStatus.BLOCKED;

      await em.flush();

      return [{}];
    },

    unblockUserInAccount: async ({ request, em, logger }) => {
      const { accountName, userId, tenantName } = request;

      const user = await em.findOne(UserAccount, {
        user: { userId, tenant: { name: tenantName } },
        account: { accountName, tenant: { name: tenantName } },
      }, { populate: ["user", "account"]});

      if (!user) {
        throw {
          code: Status.NOT_FOUND, message:`User ${userId} or account ${accountName}  is not found.`,
        } as ServiceError;
      }

      if (user.blockedInCluster === UserStatus.UNBLOCKED) {
        throw {
          code: Status.FAILED_PRECONDITION, message: `User ${userId}  is already unblocked.`,
        } as ServiceError;
      }

      // 判断如果限额和已用额度存在的情况是否可以解封
      const stillBlockUserInCluster = getUserStateInfo(
        UserStateInAccount.NORMAL,
        user.jobChargeLimit,
        user.usedJobCharge,
      ).shouldBlockInCluster;

      const currentActivatedClusters = await getActivatedClusters(em, logger);
      if (!stillBlockUserInCluster) {
        await unblockUserInAccount(user, currentActivatedClusters, server.ext, logger);
        user.blockedInCluster = UserStatus.UNBLOCKED;
      }
      user.state = UserStateInAccount.NORMAL;

      await em.flush();

      return [{}];
    },

    setAsAdmin: async ({ request, em }) => {
      const { accountName, userId, tenantName } = request;

      const user = await em.findOne(UserAccount, {
        user: { userId, tenant: { name: tenantName } },
        account: { accountName, tenant: { name: tenantName } },
      });

      if (!user) {
        throw {
          code: Status.NOT_FOUND, message:`User ${userId} or account ${accountName}  is not found.`,
        } as ServiceError;
      }

      if (user.role === UserRole.ADMIN) {
        throw {
          code: Status.FAILED_PRECONDITION, message: `User ${userId} is already admin.`,
        } as ServiceError;
      }

      user.role = UserRole.ADMIN;
      await em.flush();

      return [{}];
    },

    unsetAdmin: async ({ request, em }) => {
      const { accountName, userId, tenantName } = request;

      const user = await em.findOne(UserAccount, {
        user: { userId, tenant: { name: tenantName } },
        account: { accountName, tenant: { name: tenantName } },
      });

      if (!user) {
        throw {
          code: Status.NOT_FOUND, message:`User ${userId} or account ${accountName}  is not found.`,
        } as ServiceError;
      }

      if (user.role === UserRole.USER) {
        throw {
          code: Status.FAILED_PRECONDITION, message: `User ${userId} is already not admin.`,
        } as ServiceError;
      }

      user.role = UserRole.USER;
      await em.flush();

      return [{}];
    },

    /**
     * 新增用户，在数据库中增加用户后调用auth服务在ldap中增加该用户，
     * 并将公钥插入用户的authorized_keys
     */
    createUser: async ({ request, em, logger }) => {
      const { name, tenantName, email, identityId, password } = request;
      const user =
      await createUserInDatabase(identityId, name, email, tenantName, server.logger, em)
        .catch((e) => {
          if (e.code === Status.ALREADY_EXISTS) {
            throw {
              code: Status.ALREADY_EXISTS,
              message: `User with userId ${identityId} already exists in scow.`,
              details: "EXISTS_IN_SCOW",
            } as ServiceError;
          }
          throw {
            code: Status.INTERNAL,
            message: `Error creating user with userId ${identityId} in database.` } as ServiceError;
        });
      // call auth
      const createdInAuth = await createUser(authUrl,
        { identityId: user.userId, id: user.id, mail: user.email, name: user.name, password },
        server.logger)
        .then(async () => {
          // insert public key
          // 插入公钥失败也认为是创建用户成功
          // 在所有集群下执行
          // 如果 SCOWD 开启则不需要插入公钥
          const filterClusterConfig = Object.fromEntries(
            Object.entries(configClusters).filter(([_, value]) => value.scowd?.enabled !== true));

          await insertKeyToNewUser(identityId, password, server.logger, filterClusterConfig)
            .catch(() => {});
          return true;
        })
        // If the call of creating user of auth fails,  delete the user created in the database.
        .catch(async (e) => {
          if (e.status === 409) {
            server.logger.warn("User exists in auth.");
            return false;
          } else {
            // 回滚数据库
            await em.removeAndFlush(user);
            server.logger.error("Error creating user in auth.", e);
            throw {
              code: Status.INTERNAL,
              message: `Error creating user with userId ${identityId} in auth.` } as ServiceError;
          }
        });

      await callHook("userCreated", { tenantName, userId: user.userId }, logger);

      return [{
        createdInAuth: createdInAuth,
        id: user.id,
      }];
    },

    /**
     * 仅在数据库中增加用户数据，用于结合自定义认证系统新增用户，
     * 与createUser的区别在于不需要password，不调用auth服务，暂不将公钥插入用户authorized_keys
     */
    addUser: async ({ request, em, logger }) => {
      const { name, tenantName, email, identityId } = request;
      const user
       = await createUserInDatabase(identityId, name, email, tenantName, server.logger, em)
         .catch((e) => {
           if (e.code === Status.ALREADY_EXISTS) {
             throw {
               code: Status.ALREADY_EXISTS,
               message: `User with userId ${identityId} already exists in scow.`,
               details: "EXISTS_IN_SCOW",
             } as ServiceError;
           }
           throw {
             code: Status.INTERNAL,
             message: `Error creating user with userId ${identityId} in database.` } as ServiceError;
         });

      await callHook("userAdded", { tenantName, userId: user.userId }, logger);

      return [{
        id: user.id,
      }];
    },

    deleteUser: async ({ request, em, logger }) => {
      const { userId, tenantName, deletionComment }
         = ensureNotUndefined(request, ["userId", "tenantName"]);

      const tenant = await em.findOne(Tenant, { name: tenantName });

      if (!tenant) {
        throw { code: Status.NOT_FOUND, message: `Tenant ${tenantName} is not found.` } as ServiceError;
      }

      const user = await em.findOne(User, { userId, tenant: { name: tenantName } }, {
        populate: ["accounts", "accounts.account"],
      });

      if (!user) {
        throw { code: Status.NOT_FOUND, message: `User ${userId} is not found.` } as ServiceError;
      }

      if (user.state === UserState.DELETED) {
        throw { code: Status.NOT_FOUND, message: `User ${userId} has been deleted.` } as ServiceError;
      }

      if (user.platformRoles.includes(PlatformRole.PLATFORM_ADMIN)) {
        throw {
          code: Status.INTERNAL,
          message: "Platform administrators cannot be deleted.",
        } as ServiceError;
      }

      const userAccounts = user.accounts.getItems();
      // 这里商量是不要管有没有封锁直接删，但要不要先封锁了再删？

      // 如果用户为账户拥有者且该用户没有被删除，提示管理员需要先删除拥有的账户再删除用户
      const countAccountOwner = async () => {
        const ownedAccounts = userAccounts
          .filter((userAccount) => PFUserRole[userAccount.role] === PFUserRole.OWNER)
          .map((userAccount) => {
            const account = userAccount.account.getEntity();
            const { accountName, state } = account;
            return state !== AccountState.DELETED ? accountName : null;
          })
          .filter((accountName) => accountName !== null);

        return ownedAccounts;
      };

      const needDeleteAccounts = await countAccountOwner().catch((error) => {
        console.error("Error processing countAccountOwner:", error);
        return [];
      });

      if (needDeleteAccounts.length > 0) {
        const needDeleteAccountsObj = {
          userId,
          accounts: needDeleteAccounts,
          type: "ACCOUNTS_OWNER",
        };
        throw {
          code: Status.FAILED_PRECONDITION,
          message: JSON.stringify(needDeleteAccountsObj),
        } as ServiceError;
      }

      const currentActivatedClusters = await getActivatedClusters(em, logger);
      // 查询用户是否有RUNNING、PENDING的作业与交互式应用，有则抛出异常
      const runningJobs = await server.ext.clusters.callOnAll(
        currentActivatedClusters,
        logger,
        async (client) => {
          const fields = ["job_id", "user", "state", "account"];

          return await asyncClientCall(client.job, "getJobs", {
            fields,
            filter: { users: [userId], accounts: [], states: ["RUNNING", "PENDING"]},
          });
        },
      );

      if (runningJobs.filter((i) => i.result.jobs.length > 0).length > 0) {
        const a = runningJobs.filter((i) => i.result.jobs.length > 0);
        a.forEach((i) => {
          i.result.jobs.forEach((c) => console.log(c));
        });
        const runningJobsObj = {
          userId,
          type: "RUNNING_JOBS",
        };
        throw {
          code: Status.FAILED_PRECONDITION,
          message: JSON.stringify(runningJobsObj),
        } as ServiceError;
      }

      // 当前接口要求的最低调度器接口版本
      const minRequiredApiVersion: ApiVersion = { major: 1, minor: 7, patch: 0 };
      await server.ext.clusters.callOnAll(currentActivatedClusters, logger, async (client) => {
        // 当前接口要求的最低调度器接口版本
        // 检查调度器的 API 版本
        await checkSchedulerApiVersion(client, minRequiredApiVersion);
      }).catch(() => {

        const details = "The method is not supported with the current scheduler adapter version. " +
          "To use this method, the scheduler adapter must be upgraded to version " +
          `${minRequiredApiVersion.major}.${minRequiredApiVersion.minor}.${minRequiredApiVersion.patch} or higher.`;

        logger.error(details, "Scheduler API version mismatch.");

        throw {
          code: Status.UNIMPLEMENTED,
          message: details,
        } as ServiceError;
      });

      // 处理用户账户关系表，删除用户与除其拥有的所有账户的关系
      const hasCapabilities = server.ext.capabilities.accountUserRelation;

      for (const userAccount of userAccounts) {
        if (PFUserRole[userAccount.role] === PFUserRole.OWNER) {
          continue;
        }
        const accountName = userAccount.account.getEntity().accountName;
        await em.removeAndFlush(userAccount);
        await server.ext.clusters.callOnAll(currentActivatedClusters, logger, async (client) => {
          return await asyncClientCall(client.user, "removeUserFromAccount",
            { userId, accountName });
        }).catch(async (e) => {
          // 如果每个适配器返回的Error都是NOT_FOUND，说明所有集群均已将此用户移出账户，可以在scow数据库及认证系统中删除该条关系，
          // 除此以外，都抛出异常
          if (countSubstringOccurrences(e.details, "Error: 5 NOT_FOUND")
              !== Object.keys(currentActivatedClusters).length) {
            throw e;
          }
        });
        if (hasCapabilities) {
          await removeUserFromAccount(authUrl, { accountName, userId }, logger);
        }
      }

      user.state = UserState.DELETED;
      user.deletionComment = deletionComment?.trim();

      const nameMarker = misConfig?.deleteUser?.nameMarker || "";
      user.name += nameMarker;
      await em.flush();

      await callHook("userDeleted", { tenantName, userId: user.userId }, logger);

      const ldapCapabilities = await getCapabilities(authUrl);
      if (ldapCapabilities.deleteUser) {

        await deleteUser(authUrl,
          userId, server.logger)
          .catch(async (e) => {
            if (e instanceof HttpError && e.status === 404) {
              throw {
                code: Status.NOT_FOUND,
                message: "User not found in LDAP." } as ServiceError;
            }
            throw {
              code: Status.INTERNAL,
              message: "Error nologin user in LDAP." } as ServiceError;
          });
      }

      await server.ext.clusters.callOnAll(currentActivatedClusters, logger, async (client) => {
        return await asyncClientCall(client.user, "deleteUser",
          { userId });
      }).catch(async (e) => {
        // 如果每个适配器返回的Error都是NOT_FOUND，说明所有集群均已移出此用户
        // 除此以外，都抛出异常
        if (countSubstringOccurrences(e.details, "Error: 5 NOT_FOUND")
                 !== Object.keys(currentActivatedClusters).length) {
          logger.error(e, "deleteUser Error occurred.");
          throw e;
        }
      });

      return [{}];
    },



    checkUserNameMatch: async ({ request, em }) => {
      const { userId, name } = request;

      // query auth
      if (server.ext.capabilities.getUser) {
        const authUser = await getUser(authUrl, { identityId: userId }, server.logger);

        if (!authUser) {
          throw { code: Status.NOT_FOUND, message:`User ${userId} is not found from auth` } as ServiceError;
        }

        if (authUser.name !== undefined) {
          return [{ match: authUser.name === name }];
        }
      }

      // auth doesn't support getUser or user name is not set in auth
      // check mis db
      const user = await em.findOne(User, { userId }, { fields: ["name"]});

      if (!user) {
        throw { code: Status.NOT_FOUND, message:`User ${userId} is not found in mis db` } as ServiceError;
      }

      return [{ match: user.name === name }];
    },

    getUsers: async ({ request, em }) => {
      const { tenantName } = request;

      const users = await em.find(User, { tenant: { name: tenantName } }, {
        populate: ["tenant", "accounts", "accounts.account"],
      });

      return [{ users: users.map((x) => ({
        tenantName: x.tenant.$.name,
        email: x.email,
        name: x.name,
        phone: x.phone,
        organization: x.organization,
        adminComment: x.adminComment,
        metadata: x.metadata,
        userId: x.userId,
        createTime: x.createTime.toISOString(),
        tenantRoles: x.tenantRoles.map(tenantRoleFromJSON),
        accountAffiliations: x.accounts.getItems().map((x) => ({
          accountName: x.account.getEntity().accountName,
          role: PFUserRole[x.role],
          accountState: PFAccountState["ACCOUNT_" + x.account.getEntity().state] as PFAccountState,
        })),
        platformRoles: x.platformRoles.map(platformRoleFromJSON),
        state:userStateFromJSON(x.state),
      })) } ];
    },

    getUserInfo: async ({ request, em }) => {

      const { userId } = request;

      const user = await em.findOne(User, {
        userId,
      }, { populate: ["accounts", "accounts.account", "tenant", "email"]});

      if (!user) {
        throw { code: Status.NOT_FOUND, message:`User ${userId} is not found.` } as ServiceError;
      }

      return [{
        affiliations: user.accounts.getItems().map((x) => ({
          accountName: x.account.getEntity().accountName,
          role: PFUserRole[x.role],
          accountState: PFAccountState["ACCOUNT_" + x.account.getEntity().state] as PFAccountState,
        })),
        tenantName: user.tenant.$.name,
        name: user.name,
        email: user.email,
        phone: user.phone,
        organization: user.organization,
        adminComment: user.adminComment,
        metadata: user.metadata,
        tenantRoles: user.tenantRoles.map(tenantRoleFromJSON),
        platformRoles: user.platformRoles.map(platformRoleFromJSON),
        createTime:user.createTime.toISOString(),
      }];
    },

    getAllUsers: async ({ request, em }) => {

      const { page, pageSize, sortField, sortOrder, idOrName, platformRole } = request;

      const roleQuery = platformRole !== undefined ? {
        platformRoles: { $like: `%${platformRoleToJSON(platformRole)}%` },
      } : {};

      const [users, count] = await em.findAndCount(User, idOrName ? {
        $and: [
          {
            $or: [
              { userId: { $like: `%${idOrName}%` } },
              { name: { $like: `%${idOrName}%` } },
            ],
          },
          roleQuery,
        ],
      } : roleQuery, {
        ...generateAllUsersQueryOptions(page, pageSize, sortField, sortOrder),
        populate: ["tenant", "accounts", "accounts.account"],
      });

      return [{
        totalCount: count,
        platformUsers: users.map((x) => ({
          userId: x.userId,
          name: x.name,
          email: x.email,
          phone: x.phone,
          organization: x.organization,
          adminComment: x.adminComment,
          metadata: x.metadata,
          availableAccounts: x.accounts.getItems()
            .filter((ua) => ua.blockedInCluster === UserStatus.UNBLOCKED &&
            ua.account.getProperty("state") !== AccountState.DELETED)
            .map((ua) => {
              return ua.account.getProperty("accountName");
            }),
          tenantName: x.tenant.$.name,
          createTime: x.createTime.toISOString(),
          platformRoles: x.platformRoles.map(platformRoleFromJSON),
          state:userStateFromJSON(x.state),
        })),
      }];
    },

    getUsersByIds: async ({ request, em }) => { // 操作日志调用，可以展示已删除
      const { userIds, fetchAllWhenEmpty = false } = request;

      // 动态构造查询条件
      const condition = fetchAllWhenEmpty && userIds.length === 0
        ? {} // 条件为空时查询全部用户
        : { userId: { $in: userIds } }; // 默认行为：按userIds过滤

      const users = await em.find(User, condition, {
        fields: ["userId", "name"],
      });

      return [{
        users: users.map((x) => ({
          userId: x.userId,
          userName: x.name,
        })),
      }];
    },

    getPlatformUsersCounts: async ({ request, em }) => {
      const { idOrName } = request;
      const idOrNameQuery = idOrName ? {
        $and: [
          {
            $or: [
              { userId: { $like: `%${idOrName}%` } },
              { name: { $like: `%${idOrName}%` } },
            ],
          },
        ],
      } : {};
      const totalCount = await em.count(User, idOrNameQuery);
      const totalAdminCount = await em.count(User,
        { platformRoles: { $like: `%${PlatformRole.PLATFORM_ADMIN}%` }, ...idOrNameQuery });
      const totalFinanceCount = await em.count(User,
        { platformRoles: { $like: `%${PlatformRole.PLATFORM_FINANCE}%` }, ...idOrNameQuery });

      return [{
        totalCount: totalCount,
        totalAdminCount: totalAdminCount,
        totalFinanceCount: totalFinanceCount,
      }];
    },

    setPlatformRole: async ({ request, em }) => {
      const { userId, roleType } = request;
      const dbRoleType: PlatformRole = PlatformRole[platformRoleToJSON(roleType)];

      const user = await em.findOne(User, { userId: userId });

      if (!user || user.state == UserState.DELETED) {
        throw {
          code: Status.NOT_FOUND, message: `User ${userId} is not found.`,
        } as ServiceError;
      }

      if (user.platformRoles.includes(dbRoleType)) {
        throw {
          code: Status.FAILED_PRECONDITION, message: `User ${userId} is already this role.`,
        } as ServiceError;
      }

      user.platformRoles.push(dbRoleType);
      await em.flush();

      return [{}];
    },

    unsetPlatformRole: async ({ request, em }) => {
      const { userId, roleType } = request;
      const dbRoleType: PlatformRole = PlatformRole[platformRoleToJSON(roleType)];

      const user = await em.findOne(User, { userId: userId });

      if (!user || user.state === UserState.DELETED) {
        throw {
          code: Status.NOT_FOUND, message: `User ${userId} is either not found or has been deleted.`,
        } as ServiceError;
      }

      if (!user.platformRoles.includes(dbRoleType)) {
        throw {
          code: Status.FAILED_PRECONDITION, message: `User ${userId} is already not this role.`,
        } as ServiceError;
      }

      user.platformRoles = user.platformRoles.filter((item) =>
        item !== dbRoleType);
      await em.flush();

      return [{}];
    },

    setTenantRole: async ({ request, em }) => {
      const { userId, roleType } = request;
      const dbRoleType: TenantRole = TenantRole[tenantRoleToJSON(roleType)];

      const user = await em.findOne(User, { userId: userId });

      if (!user || user.state === UserState.DELETED) {
        throw {
          code: Status.NOT_FOUND, message: `User ${userId} is either not found or has been deleted.`,
        } as ServiceError;
      }

      if (user.tenantRoles.includes(dbRoleType)) {
        throw {
          code: Status.FAILED_PRECONDITION, message: `User ${userId} is already this role.`,
        } as ServiceError;
      }

      user.tenantRoles.push(dbRoleType);
      await em.flush();

      return [{}];
    },

    unsetTenantRole: async ({ request, em }) => {
      const { userId, roleType } = request;
      const dbRoleType: TenantRole = TenantRole[tenantRoleToJSON(roleType)];

      const user = await em.findOne(User, { userId: userId });

      if (!user || user.state === UserState.DELETED) {
        throw {
          code: Status.NOT_FOUND, message: `User ${userId} is either not found or has been deleted.`,
        } as ServiceError;
      }

      if (!user.tenantRoles.includes(dbRoleType)) {
        throw {
          code: Status.FAILED_PRECONDITION, message: `User ${userId} is already not this role.`,
        } as ServiceError;
      }

      user.tenantRoles = user.tenantRoles.filter((item) =>
        item !== dbRoleType);
      await em.flush();
      return [{}];

    },
    changeEmail: async ({ request, em, logger }) => {
      const { userId, newEmail } = request;

      const user = await em.findOne(User, { userId: userId });

      if (!user || user.state === UserState.DELETED) {
        throw {
          code: Status.NOT_FOUND, message: `User ${userId} is either not found or has been deleted.`,
        } as ServiceError;
      }

      user.email = newEmail;
      em.persist(user);

      const ldapCapabilities = await getCapabilities(authUrl);

      // 看LDAP是否有修改邮箱的权限
      if (ldapCapabilities.changeEmail) {
        await libChangeEmail(authUrl, {
          identityId: userId,
          newEmail,
        }, logger)
          .catch(async (e) => {

            if (e instanceof HttpError) {
              switch (e.status) {

                case 404:
                  throw {
                    code: Status.NOT_FOUND, message: `User ${userId} is not found.`,
                  } as ServiceError;

                case 501:
                  throw {
                    code: Status.UNIMPLEMENTED, message: "Changing email is not supported ",
                  } as ServiceError;

                default:
                  throw {
                    code: Status.UNKNOWN, message: "LDAP failed to change email",
                  } as ServiceError;
              }
            } else {
              throw {
                code: Status.UNKNOWN, message: "LDAP failed to change email",
              } as ServiceError;
            }


          });
      }

      await em.flush();

      return [{}];
    },

    changeUserProfile: async ({ request, em, logger }) => {
      const { userId, email, phone, organization, adminComment, metadata } = request;

      const user = await em.findOne(User, { userId: userId });

      if (!user || user.state === UserState.DELETED) {
        throw {
          code: Status.NOT_FOUND, message: `User ${userId} is either not found or has been deleted.`,
        } as ServiceError;
      }

      const ldapCapabilities = await getCapabilities(authUrl);

      // 看LDAP是否有修改邮箱的权限
      if (ldapCapabilities.changeEmail && (email !== undefined && user.email !== email)) {
        await libChangeEmail(authUrl, {
          identityId: userId,
          newEmail: email,
        }, logger)
          .catch(async (e) => {

            if (e instanceof HttpError) {
              switch (e.status) {

                case 404:
                  throw {
                    code: Status.NOT_FOUND, message: `User ${userId} is not found.`,
                  } as ServiceError;

                case 501:
                  throw {
                    code: Status.UNIMPLEMENTED, message: "Changing email is not supported ",
                  } as ServiceError;

                default:
                  throw {
                    code: Status.UNKNOWN, message: "LDAP failed to change email",
                  } as ServiceError;
              }
            } else {
              throw {
                code: Status.UNKNOWN, message: "LDAP failed to change email",
              } as ServiceError;
            }
          });
      }

      user.email = email !== undefined ? email : user.email;
      user.phone = phone !== undefined ? phone : user.phone;
      user.organization = organization !== undefined ? organization : user.organization;
      user.adminComment = adminComment !== undefined ? adminComment : user.adminComment;
      user.metadata = metadata !== undefined ? metadata : user.metadata;

      await em.persistAndFlush(user);

      return [{}];
    },

    getNewUserCount: async ({ request, em, logger }) => {
      const { startTime, endTime, timeZone = "UTC" } = ensureNotUndefined(request, ["startTime", "endTime"]);

      checkTimeZone(timeZone);

      const qb = em.createQueryBuilder(User, "u");
      void qb
        .select([raw("DATE(CONVERT_TZ(u.create_time, 'UTC', ?)) as date", [timeZone]), raw("count(*) as count")])
        .where({ createTime: { $gte: startTime } })
        .andWhere({ createTime: { $lte: endTime } })
        .groupBy(raw("date"))
        .orderBy({ [raw("date")]: QueryOrder.DESC });

      const results: { date: string, count: number }[] = await qb.execute();

      return [
        {
          results: results.map((record) => ({
            date: convertToDateMessage(record.date, logger),
            count: record.count,
          })),
        },
      ];
    },

    changeTenant: async ({ request, em }) => {
      const { userId, tenantName } = request;

      const user = await em.findOne (User, { userId }, { populate: ["tenant"]});

      if (!user || user.state === UserState.DELETED) {
        throw {
          code: Status.NOT_FOUND, message: `User ${userId} is either not found or has been deleted.`
          , details: "USER_NOT_FOUND",
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

      const oldTenant = user.tenant.getEntity();

      if (oldTenant.name === tenantName) {
        throw {
          code: Status.ALREADY_EXISTS, message: `User ${userId} is already in tenant ${tenantName}.`,
        } as ServiceError;
      }

      const newTenant = await em.findOne(Tenant, { name: tenantName });

      if (!newTenant) {
        throw {
          code: Status.NOT_FOUND, message: `Tenant ${tenantName} is not found.`, details: "TENANT_NOT_FOUND",
        } as ServiceError;
      }

      em.assign(user, { tenant: newTenant });

      await em.persistAndFlush(user);

      return [{}];

    },

  });
});
