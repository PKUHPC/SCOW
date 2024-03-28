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
import { ensureNotUndefined, plugin } from "@ddadaal/tsgrpc-server";
import { ServiceError } from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { QueryOrder, raw } from "@mikro-orm/core";
import { addUserToAccount, changeEmail as libChangeEmail, createUser, getCapabilities, getUser, removeUserFromAccount,
}
  from "@scow/lib-auth";
import { decimalToMoney } from "@scow/lib-decimal";
import { checkTimeZone, convertToDateMessage } from "@scow/lib-server/build/date";
import {
  AccountStatus,
  accountUserInfo_UserStateInAccountFromJSON, GetAccountUsersResponse,
  platformRoleFromJSON,
  platformRoleToJSON,
  QueryIsUserInAccountResponse,
  tenantRoleFromJSON,
  tenantRoleToJSON,
  UserRole as PFUserRole, UserServiceServer,
  UserServiceService,
  UserStatus as PFUserStatus } from "@scow/protos/build/server/user";
import { blockUserInAccount, unblockUserInAccount } from "src/bl/block";
import { authUrl } from "src/config";
import { clusters } from "src/config/clusters";
import { Account } from "src/entities/Account";
import { Tenant } from "src/entities/Tenant";
import { PlatformRole, TenantRole, User } from "src/entities/User";
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
        throw <ServiceError>{
          code: Status.NOT_FOUND, message: `User ${userId}, tenant ${tenantName} is not found`,
        };
      }

      return [{
        accountStatuses: user.accounts.getItems().reduce((prev, curr) => {
          const account = curr.account.getEntity();
          prev[account.accountName] = {
            accountBlocked: Boolean(account.blockedInCluster),
            userStatus: PFUserStatus[curr.blockedInCluster],
            jobChargeLimit: curr.jobChargeLimit ? decimalToMoney(curr.jobChargeLimit) : undefined,
            usedJobCharge: curr.usedJobCharge ? decimalToMoney(curr.usedJobCharge) : undefined,
            balance: decimalToMoney(curr.account.getEntity().balance),
          } as AccountStatus;
          return prev;
        }, {}),
        storageQuotas: user.storageQuotas.getItems().reduce((prev, curr) => {
          prev[curr.cluster] = curr.storageQuota;
          return prev;
        }, {}),
      }];
    },

    queryUsedStorageQuota: async ({}) => {
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
      const { accountName, userId, tenantName } = request;

      const account = await em.findOne(Account, {
        accountName, tenant: { name: tenantName },
      }, { populate: ["users", "users.user", "tenant"]});

      const user = await em.findOne(User, {
        userId, tenant: { name: tenantName },
      });

      if (!user) {
        throw <ServiceError>{
          code: Status.NOT_FOUND,
          message: `User ${userId} or tenant ${tenantName} is not found.`,
          details:"USER_OR_TENANT_NOT_FOUND",
        };
      }

      if (!account) {
        throw <ServiceError>{
          code: Status.NOT_FOUND,
          message: `Account ${accountName} or tenant ${tenantName} is not found.`,
          details:"ACCOUNT_OR_TENANT_NOT_FOUND",
        };
      }

      if (account.users.getItems().some((x) => x.user.getEntity().userId === userId)) {
        throw <ServiceError>{
          code: Status.ALREADY_EXISTS, message: `User ${userId} already in the account ${accountName}.`,
        };
      }

      await server.ext.clusters.callOnAll(logger, async (client) => {
        return await asyncClientCall(client.user, "addUserToAccount", { userId, accountName });
      }).catch(async (e) => {
        // 如果每个适配器返回的Error都是ALREADY_EXISTS，说明所有集群均已添加成功，可以在scow数据库及认证系统中加入该条关系，
        // 除此以外，都抛出异常
        if (countSubstringOccurrences(e.details, "Error: 6 ALREADY_EXISTS") !== Object.keys(clusters).length) {
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
        throw <ServiceError>{
          code: Status.NOT_FOUND, message:`User ${userId} or account ${accountName}  is not found.`,
        };
      }

      if (userAccount.role === UserRole.OWNER) {
        throw <ServiceError>{
          code: Status.OUT_OF_RANGE,
          message: `User ${userId} is the owner of the account ${accountName}。`,
        };
      }

      // 如果要从账户中移出用户，先封锁，先将用户封锁，保证用户无法提交作业
      if (userAccount.blockedInCluster === UserStatus.UNBLOCKED) {
        userAccount.state = UserStateInAccount.BLOCKED_BY_ADMIN;
        await blockUserInAccount(userAccount, server.ext, logger);
        await em.flush();
      }

      // 查询用户是否有RUNNING、PENDING的作业，如果有，抛出异常
      const jobs = await server.ext.clusters.callOnAll(
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
        throw <ServiceError>{
          code: Status.FAILED_PRECONDITION,
          message: `User ${userId} has jobs running or pending and cannot remove.
          Please wait for the job to end or end the job manually before moving out.`,
        };
      }

      await server.ext.clusters.callOnAll(logger, async (client) => {
        return await asyncClientCall(client.user, "removeUserFromAccount", { userId, accountName });
      }).catch(async (e) => {
        // 如果每个适配器返回的Error都是NOT_FOUND，说明所有集群均已将此用户移出账户，可以在scow数据库及认证系统中删除该条关系，
        // 除此以外，都抛出异常
        if (countSubstringOccurrences(e.details, "Error: 5 NOT_FOUND") !== Object.keys(clusters).length) {
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
        throw <ServiceError>{
          code: Status.NOT_FOUND, message: `User ${userId} or account ${accountName} is not found.`,
        };
      }

      // 如果已经在集群下为封锁，且状态值为被账户管理员或拥有者手动封锁
      if (user.blockedInCluster === UserStatus.BLOCKED && user.state === UserStateInAccount.BLOCKED_BY_ADMIN) {
        throw <ServiceError> {
          code: Status.FAILED_PRECONDITION, message: `User ${userId}  is already blocked.`,
        };
      }

      await blockUserInAccount(user, server.ext, logger);
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
        throw <ServiceError>{
          code: Status.NOT_FOUND, message:`User ${userId} or account ${accountName}  is not found.`,
        };
      }

      if (user.blockedInCluster === UserStatus.UNBLOCKED) {
        throw <ServiceError> {
          code: Status.FAILED_PRECONDITION, message: `User ${userId}  is already unblocked.`,
        };
      }

      // 判断如果限额和已用额度存在的情况是否可以解封
      const stillBlockUserInCluster = getUserStateInfo(
        UserStateInAccount.NORMAL,
        user.jobChargeLimit,
        user.usedJobCharge,
      ).shouldBlockInCluster;

      if (!stillBlockUserInCluster) {
        await unblockUserInAccount(user, server.ext, logger);
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
        throw <ServiceError>{
          code: Status.NOT_FOUND, message:`User ${userId} or account ${accountName}  is not found.`,
        };
      }

      if (user.role === UserRole.ADMIN) {
        throw <ServiceError> {
          code: Status.FAILED_PRECONDITION, message: `User ${userId} is already admin.`,
        };
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
        throw <ServiceError>{
          code: Status.NOT_FOUND, message:`User ${userId} or account ${accountName}  is not found.`,
        };
      }

      if (user.role === UserRole.USER) {
        throw <ServiceError> {
          code: Status.FAILED_PRECONDITION, message: `User ${userId} is already not admin.`,
        };
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
      const user = await createUserInDatabase(identityId, name, email, tenantName, server.logger, em)
        .catch((e) => {
          if (e.code === Status.ALREADY_EXISTS) {
            throw <ServiceError> {
              code: Status.ALREADY_EXISTS,
              message: `User with userId ${identityId} already exists in scow.`,
              details: "EXISTS_IN_SCOW",
            };
          }
          throw <ServiceError> {
            code: Status.INTERNAL,
            message: `Error creating user with userId ${identityId} in database.` };
        });
      // call auth
      const createdInAuth = await createUser(authUrl,
        { identityId: user.userId, id: user.id, mail: user.email, name: user.name, password },
        server.logger)
        .then(async () => {
          // insert public key
          await insertKeyToNewUser(identityId, password, server.logger)
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
            throw <ServiceError> {
              code: Status.INTERNAL,
              message: `Error creating user with userId ${identityId} in auth.` };
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
      const user = await createUserInDatabase(identityId, name, email, tenantName, server.logger, em)
        .catch((e) => {
          if (e.code === Status.ALREADY_EXISTS) {
            throw <ServiceError> {
              code: Status.ALREADY_EXISTS,
              message: `User with userId ${identityId} already exists in scow.`,
              details: "EXISTS_IN_SCOW",
            };
          }
          throw <ServiceError> {
            code: Status.INTERNAL,
            message: `Error creating user with userId ${identityId} in database.` };
        });

      await callHook("userAdded", { tenantName, userId: user.userId }, logger);

      return [{
        id: user.id,
      }];
    },

    deleteUser: async ({ request, em }) => {
      const { userId, tenantName } = request;

      const user = await em.findOne(User, { userId, tenant: { name: tenantName } });
      if (!user) {
        throw <ServiceError>{ code: Status.NOT_FOUND, message:`User ${userId} is not found.` };
      }

      // find if the user is an owner of any account
      const accountUser = await em.findOne(UserAccount, {
        user,
        role: UserRole.OWNER,
      });

      if (accountUser) {
        throw <ServiceError>{
          code: Status.FAILED_PRECONDITION,
          details: `User ${userId} is an owner of an account.`,
        };
      }

      await em.removeAndFlush(user);
      return [{}];
    },

    checkUserNameMatch: async ({ request, em }) => {
      const { userId, name } = request;

      // query auth
      if (server.ext.capabilities.getUser) {
        const authUser = await getUser(authUrl, { identityId: userId }, server.logger);

        if (!authUser) {
          throw <ServiceError> { code: Status.NOT_FOUND, message:`User ${userId} is not found from auth` };
        }

        if (authUser.name !== undefined) {
          return [{ match: authUser.name === name }];
        }
      }

      // auth doesn't support getUser or user name is not set in auth
      // check mis db
      const user = await em.findOne(User, { userId }, { fields: ["name"]});

      if (!user) {
        throw <ServiceError> { code: Status.NOT_FOUND, message:`User ${userId} is not found in mis db` };
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
        userId: x.userId,
        createTime: x.createTime.toISOString(),
        tenantRoles: x.tenantRoles.map(tenantRoleFromJSON),
        accountAffiliations: x.accounts.getItems().map((x) => ({
          accountName: x.account.getEntity().accountName,
          role: PFUserRole[x.role],
        })),
        platformRoles: x.platformRoles.map(platformRoleFromJSON),
      })) } ];
    },

    getUserInfo: async ({ request, em }) => {

      const { userId } = request;

      const user = await em.findOne(User, {
        userId,
      }, { populate: ["accounts", "accounts.account", "tenant", "email"]});

      if (!user) {
        throw <ServiceError>{ code: Status.NOT_FOUND, message:`User ${userId} is not found.` };
      }

      return [{
        affiliations: user.accounts.getItems().map((x) => ({
          accountName: x.account.getEntity().accountName,
          role: PFUserRole[x.role],
        })),
        tenantName: user.tenant.$.name,
        name: user.name,
        email: user.email,
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
          availableAccounts: x.accounts.getItems()
            .filter((ua) => ua.blockedInCluster === UserStatus.UNBLOCKED)
            .map((ua) => {
              return ua.account.getProperty("accountName");
            }),
          tenantName: x.tenant.$.name,
          createTime: x.createTime.toISOString(),
          platformRoles: x.platformRoles.map(platformRoleFromJSON),
        })),
      }];
    },

    getUsersByIds: async ({ request, em }) => {
      const { userIds } = request;

      const users = await em.find(User, { userId: { $in: userIds } });

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

      if (!user) {
        throw <ServiceError>{
          code: Status.NOT_FOUND, message: `User ${userId} is not found.`,
        };
      }

      if (user.platformRoles.includes(dbRoleType)) {
        throw <ServiceError> {
          code: Status.FAILED_PRECONDITION, message: `User ${userId} is already this role.`,
        };
      }

      user.platformRoles.push(dbRoleType);
      await em.flush();

      return [{}];
    },

    unsetPlatformRole: async ({ request, em }) => {
      const { userId, roleType } = request;
      const dbRoleType: PlatformRole = PlatformRole[platformRoleToJSON(roleType)];

      const user = await em.findOne(User, { userId: userId });

      if (!user) {
        throw <ServiceError>{
          code: Status.NOT_FOUND, message: `User ${userId} is not found.`,
        };
      }

      if (!user.platformRoles.includes(dbRoleType)) {
        throw <ServiceError> {
          code: Status.FAILED_PRECONDITION, message: `User ${userId} is already not this role.`,
        };
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

      if (!user) {
        throw <ServiceError>{
          code: Status.NOT_FOUND, message: `User ${userId} is not found.`,
        };
      }

      if (user.tenantRoles.includes(dbRoleType)) {
        throw <ServiceError> {
          code: Status.FAILED_PRECONDITION, message: `User ${userId} is already this role.`,
        };
      }

      user.tenantRoles.push(dbRoleType);
      await em.flush();

      return [{}];
    },

    unsetTenantRole: async ({ request, em }) => {
      const { userId, roleType } = request;
      const dbRoleType: TenantRole = TenantRole[tenantRoleToJSON(roleType)];

      const user = await em.findOne(User, { userId: userId });

      if (!user) {
        throw <ServiceError>{
          code: Status.NOT_FOUND, message: `User ${userId} is not found.`,
        };
      }

      if (!user.tenantRoles.includes(dbRoleType)) {
        throw <ServiceError> {
          code: Status.FAILED_PRECONDITION, message: `User ${userId} is already not this role.`,
        };
      }

      user.tenantRoles = user.tenantRoles.filter((item) =>
        item !== dbRoleType);
      await em.flush();
      return [{}];

    },
    changeEmail: async ({ request, em, logger }) => {
      const { userId, newEmail } = request;

      const user = await em.findOne(User, { userId: userId });

      if (!user) {
        throw <ServiceError>{
          code: Status.NOT_FOUND, message: `User ${userId} is not found.`,
        };
      }

      user.email = newEmail;
      await em.flush();

      const ldapCapabilities = await getCapabilities(authUrl);

      // 看LDAP是否有修改邮箱的权限
      if (ldapCapabilities.changeEmail) {
        await libChangeEmail(authUrl, {
          identityId: userId,
          newEmail,
        }, logger)
          .catch(async (e) => {
            switch (e.status) {

            case "NOT_FOUND":
              throw <ServiceError>{
                code: Status.NOT_FOUND, message: `User ${userId} is not found.`,
              };

            case "NOT_SUPPORTED":
              throw <ServiceError>{
                code: Status.UNIMPLEMENTED, message: "Changing email is not supported ",
              };

            default:
              throw <ServiceError> {
                code: Status.UNKNOWN, message: "LDAP failed to change email",
              };
            }
          });
      }

      return [{}];
    },

    getNewUserCount: async ({ request, em, logger }) => {
      const { startTime, endTime, timeZone = "UTC" } = ensureNotUndefined(request, ["startTime", "endTime"]);

      checkTimeZone(timeZone);

      const qb = em.createQueryBuilder(User, "u");
      qb
        .select([raw("DATE(CONVERT_TZ(u.create_time, 'UTC', ?)) as date", [timeZone]), raw("count(*) as count")])
        .where({ createTime: { $gte: startTime } })
        .andWhere({ createTime: { $lte: endTime } })
        .groupBy(raw("date"))
        .orderBy({ [raw("date")]: QueryOrder.DESC });

      const results: {date: string, count: number}[] = await qb.execute();

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

      if (!user) {
        throw <ServiceError>{
          code: Status.NOT_FOUND, message: `User ${userId} is not found.`, details: "USER_NOT_FOUND",
        };
      }

      const userAccount = await em.findOne(UserAccount, { user: user });

      if (userAccount) {
        throw <ServiceError>{
          code: Status.FAILED_PRECONDITION, message: `User ${userId} still maintains account relationship.`,
        };
      }

      const oldTenant = user.tenant.getEntity();

      if (oldTenant.name === tenantName) {
        throw <ServiceError>{
          code: Status.ALREADY_EXISTS, message: `User ${userId} is already in tenant ${tenantName}.`,
        };
      }

      const newTenant = await em.findOne(Tenant, { name: tenantName });

      if (!newTenant) {
        throw <ServiceError>{
          code: Status.NOT_FOUND, message: `Tenant ${tenantName} is not found.`, details: "TENANT_NOT_FOUND",
        };
      }

      em.assign(user, { tenant: newTenant });

      await em.persistAndFlush(user);

      return [{}];

    },

  });
});
