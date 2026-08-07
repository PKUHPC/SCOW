import { createWriterExtensions, ServiceError } from "@ddadaal/tsgrpc-common";
import { ensureNotUndefined, plugin } from "@ddadaal/tsgrpc-server";
import { status } from "@grpc/grpc-js";
import { FilterQuery, Loaded } from "@mikro-orm/core";
import { decimalToMoney } from "@scow/lib-decimal";
import { account_AccountStateFromJSON } from "@scow/protos/build/server/account";
import { BillListItem, BillType as BillSearchType, UserBill as UserBillType } from "@scow/protos/build/server/bill";
import { ExportServiceServer, ExportServiceService } from "@scow/protos/build/server/export";
import {
  platformRoleFromJSON,
  platformRoleToJSON,
  SortDirection,
  tenantRoleFromJSON,
  tenantRoleToJSON,
} from "@scow/protos/build/server/user";
import { Account, AccountState } from "src/entities/Account";
import { AccountBill, BillType } from "src/entities/AccountBill";
import { ChargeRecord } from "src/entities/ChargeRecord";
import { JobInfo } from "src/entities/JobInfo";
import { PayRecord } from "src/entities/PayRecord";
import { User } from "src/entities/User";
import { UserRole, UserStatus } from "src/entities/UserAccount";
import { UserBill } from "src/entities/UserBill";
import { getAccountNamesByUserIdOrName, getAccountOwnerMap } from "src/utils/account";
import { getAccountStateInfo } from "src/utils/accountUserState";
import {
  billFilter,
  buildQueryConditions,
  generateTermArray,
  mergeUserBillDetails,
  processBillSummaries,
} from "src/utils/bill";
import {
  getChargesSearchType,
  getChargesSearchTypes,
  getChargesTargetSearchParam,
  getChargesTargetSearchParamForQuery,
  getPaymentsSearchType,
  getPaymentsTargetSearchParam,
} from "src/utils/chargesQuery";
import { ensureTargetAccountsBelongToTenant } from "src/utils/chargeTargetValidation";
import {
  getJobsTargetSearchParam,
  getJobUserAndAccountOwnerDetailsMap,
  JobUserAndAccountOwnerDetailsMap,
} from "src/utils/job";
import { getAccountNamesMatchedByOwner, getUserIdsMatchedByUserIdOrName } from "src/utils/jobSearch";
import { logger } from "src/utils/logger";
import { mapUsersSortField } from "src/utils/queryOptions";
import { getUserIdsByUserIdOrName, getUserNameMap } from "src/utils/user";

export const exportServiceServer = plugin((server) => {
  server.addService<ExportServiceServer>(ExportServiceService, {
    exportUser: async (call) => {
      const { request, em } = call;
      const { sortField, sortOrder, idOrName, userId, userName, tenantName, tenantRole, platformRole, count } = request;

      const platformRoleQuery =
        platformRole !== undefined
          ? {
              platformRoles: { $like: `%${platformRoleToJSON(platformRole)}%` },
            }
          : {};

      const tenantRoleQuery =
        tenantRole !== undefined
          ? {
              tenantRoles: { $like: `%${tenantRoleToJSON(tenantRole)}%` },
            }
          : {};

      const tenantNameQuery =
        tenantName !== undefined
          ? {
              tenant: { name: tenantName },
            }
          : {};

      const filters: FilterQuery<User>[] = [];
      if (userId) {
        filters.push({ userId: { $like: `%${userId}%` } });
      }
      if (userName) {
        filters.push({ name: { $like: `%${userName}%` } });
      }
      if (!filters.length && idOrName) {
        filters.push({
          $or: [{ userId: { $like: `%${idOrName}%` } }, { name: { $like: `%${idOrName}%` } }],
        });
      }

      const userQuery = filters.length ? { $and: filters } : {};

      const query = {
        $and: [platformRoleQuery, tenantRoleQuery, tenantNameQuery, userQuery],
      };

      const recordFormat = (x: Loaded<User, "tenant" | "accounts" | "accounts.account">) => ({
        userId: x.userId,
        name: x.name,
        email: x.email,
        phone: x.phone,
        organization: x.organization,
        adminComment: x.adminComment,
        availableAccounts: x.accounts
          .getItems()
          .filter((ua) => ua.blockedInCluster === UserStatus.UNBLOCKED)
          .map((ua) => {
            return ua.account.getProperty("accountName");
          }),
        affiliatedAccounts: x.accounts
          .getItems()
          .filter((ua) => ua.account.getProperty("state") !== AccountState.DELETED)
          .map((ua) => {
            return ua.account.getProperty("accountName");
          }),
        tenantName: x.tenant.$.name,
        createTime: x.createTime.toISOString(),
        tenantRoles: x.tenantRoles.map(tenantRoleFromJSON),
        platformRoles: x.platformRoles.map(platformRoleFromJSON),
      });

      type RecordFormatReturnType = ReturnType<typeof recordFormat>;

      const batchSize = 5000;
      let offset = 0;

      const { writeAsync } = createWriterExtensions(call);

      while (offset < count) {
        const limit = Math.min(batchSize, count - offset);
        const records = (
          await em.find(User, query, {
            limit,
            offset,
            orderBy:
              sortField !== undefined && sortOrder !== undefined
                ? { [mapUsersSortField[sortField]]: sortOrder === SortDirection.ASC ? "ASC" : "DESC" }
                : undefined,
            populate: ["tenant", "accounts", "accounts.account"],
          })
        ).map(recordFormat ?? ((x) => x));

        if (records.length === 0) {
          break;
        }
        // 分片写入
        let data: RecordFormatReturnType[] = [];
        // 记录传输的总数量
        let writeTotal = 0;
        for (const row of records) {
          data.push(row);
          writeTotal += 1;
          // 每两百条传一次
          if (data.length === 200 || writeTotal === records.length) {
            await new Promise((resolve) => {
              void writeAsync({ users: data });
              // 清空暂存
              data = [];
              resolve("done");
            }).catch((e) => {
              throw {
                code: status.INTERNAL,
                message: "Error when exporting file",
                details: e?.message,
              } as ServiceError;
            });
          }
        }

        offset += limit;
      }
    },

    exportAccount: async (call) => {
      const accountsWithoutOwner: string[] = [];
      const { request, em } = call;
      const { tenantName, accountName, blocked, debt, frozen, normal, deleted, count, ownerIdOrName } = request;

      const recordFormat = (x: Loaded<Account, "tenant" | "users" | "users.user">) => {
        const owner = x.users.getItems().find((x) => x.role === UserRole.OWNER);

        if (!owner) {
          accountsWithoutOwner.push(x.accountName);
        }

        const ownerUser = owner?.user.getEntity();

        const blockThresholdAmount = x.blockThresholdAmount ?? x.tenant.$.defaultAccountBlockThreshold;
        const exportedState = getAccountStateInfo(
          x.whitelist?.id,
          x.state,
          x.balance,
          blockThresholdAmount,
        ).displayedState;

        return {
          accountName: x.accountName,
          tenantName: x.tenant.$.name,
          userCount: x.users.count(),
          displayedState: exportedState,
          ownerId: ownerUser?.userId ?? "-",
          ownerName: ownerUser?.name ?? "-",
          comment: x.comment,
          balance: decimalToMoney(x.balance),
          blockThresholdAmount: decimalToMoney(blockThresholdAmount),
          blocked: Boolean(x.blockedInCluster),
          state: account_AccountStateFromJSON(x.state),
        };
      };

      if (accountsWithoutOwner.length > 0) {
        logger.warn(
          `Found accounts without an owner. Accounts: ${accountsWithoutOwner.join(",")}. ` +
            'The items will be displayed as "-" in the exported file.',
        );
      }

      type RecordFormatReturnType = ReturnType<typeof recordFormat>;
      const batchSize = 5000;
      let offset = 0;

      const { writeAsync } = createWriterExtensions(call);

      const baseQb = em
        .createQueryBuilder(Account, "a")
        .select("*")
        .leftJoinAndSelect("a.users", "ua")
        .leftJoinAndSelect("ua.user", "u")
        .leftJoinAndSelect("a.tenant", "t");

      if (tenantName !== undefined) {
        void baseQb.andWhere({ "t.name": tenantName });
      }

      if (accountName !== undefined) {
        void baseQb.andWhere({ "a.accountName": { $like: `%${accountName}%` } });
      }

      if (blocked) {
        void baseQb.andWhere({ "a.state": AccountState.BLOCKED_BY_ADMIN, "a.blockedInCluster": true });
      }

      if (debt) {
        void baseQb
          .andWhere({ "a.state": AccountState.NORMAL })
          .andWhere("a.whitelist_id IS NULL")
          .andWhere(
            "CASE WHEN a.block_threshold_amount IS NOT NULL" +
              " THEN a.balance <= a.block_threshold_amount ELSE a.balance <= t.default_account_block_threshold END",
          );
      }

      if (frozen) {
        void baseQb.andWhere({ "a.state": AccountState.FROZEN });
      }

      if (normal) {
        void baseQb.andWhere({ "a.blockedInCluster": false });
      }

      if (deleted) {
        void baseQb.andWhere({ "a.state": AccountState.DELETED });
      }

      if (ownerIdOrName) {
        const knexQuery = baseQb.getKnexQuery();
        knexQuery.andWhere(function () {
          this.where("u.user_id", "like", `%${ownerIdOrName}%`).orWhere("u.name", "like", `%${ownerIdOrName}%`);
        });
      }

      while (offset < count) {
        const qb = baseQb.clone();
        const limit = Math.min(batchSize, count - offset);

        const queryResult = (await qb.limit(limit).offset(offset).getResultList()) as Loaded<
          Account,
          "tenant" | "users" | "users.user"
        >[];

        const records = queryResult.map(recordFormat ?? ((x) => x));

        if (records.length === 0) {
          break;
        }
        let data: RecordFormatReturnType[] = [];
        // 记录传输的总数量
        let writeTotal = 0;

        for (const row of records) {
          data.push(row);
          writeTotal += 1;
          // 每两百条传一次
          if (data.length === 200 || writeTotal === records.length) {
            await new Promise((resolve) => {
              void writeAsync({ accounts: data });
              // 清空暂存
              data = [];
              resolve("done");
            }).catch((e) => {
              throw {
                code: status.INTERNAL,
                message: "Error when exporting file",
                details: e?.message,
              } as ServiceError;
            });
          }
        }
        offset += limit;
      }
    },

    exportChargeRecord: async (call) => {
      const { request, em } = call;
      const { startTime, endTime, type, types, target, count, idsOrNames, userIds } = request;

      await ensureTargetAccountsBelongToTenant(em, target);

      const targetSearchParam = getChargesTargetSearchParam(target);
      const likePattern = (s: string) => `%${s}%`;
      const trimmedUserIdsOrNames = idsOrNames.map((x) => x.trim()).filter((x) => x.length > 0);
      const userLikePatterns = trimmedUserIdsOrNames.map(likePattern);

      const trimmedUserIds = userIds.map((x) => x.trim()).filter((x) => x.length > 0);
      const hasUserFilter = trimmedUserIdsOrNames.length > 0 || trimmedUserIds.length > 0;
      const searchParam = getChargesTargetSearchParamForQuery(targetSearchParam, hasUserFilter);
      const searchType = types.length === 0 ? getChargesSearchType(type) : getChargesSearchTypes(types);
      const tenantNameForMatchedUsers =
        typeof targetSearchParam.tenantName === "string" ? targetSearchParam.tenantName : undefined;

      // 如果有 idsOrNames 则按 idsOrNames 模糊搜索
      // 如果没有 idsOrNames 但有 userIds 则按 userIds 精确搜索
      // 都没有则不加搜索条件
      const matchedUserIds = await (async () => {
        if (userLikePatterns.length > 0) {
          const matchedUsersQuery = em
            .getKnex()("user as u")
            .distinct("u.user_id")
            .where(function () {
              for (const pattern of userLikePatterns) {
                void this.orWhere("u.user_id", "like", pattern).orWhere("u.name", "like", pattern);
              }
            });

          if (tenantNameForMatchedUsers) {
            void matchedUsersQuery
              .leftJoin("tenant as t", "u.tenant_id", "t.id")
              .andWhere("t.name", tenantNameForMatchedUsers);
          }

          const matchedUsers = await matchedUsersQuery;
          return matchedUsers.map((x: { user_id: string }) => x.user_id);
        }

        if (trimmedUserIds.length > 0) {
          return Array.from(new Set(trimmedUserIds));
        }

        return [];
      })();

      if (hasUserFilter && matchedUserIds.length === 0) {
        return;
      }

      const query = {
        time: { $gte: startTime, $lte: endTime },
        ...searchType,
        ...searchParam,
        ...(hasUserFilter ? { userId: { $in: matchedUserIds } } : {}),
      };

      const recordFormat = (x: Loaded<ChargeRecord, never>) => ({
        tenantName: x.tenantName,
        accountName: x.accountName,
        userId: x.userId,
        amount: decimalToMoney(x.amount),
        comment: x.comment,
        index: x.id,
        time: x.time.toISOString(),
        type: x.type,
      });

      const batchSize = 5000;
      let offset = 0;

      const { writeAsync } = createWriterExtensions(call);

      while (offset < count) {
        const limit = Math.min(batchSize, count - offset);

        const records = (await em.find(ChargeRecord, query, { limit, offset })).map(recordFormat ?? ((x) => x));

        if (records.length === 0) {
          break;
        }

        await writeAsync({ chargeRecords: records });

        offset += limit;
      }
    },

    exportPayRecord: async (call) => {
      const { request, em } = call;
      const { startTime, endTime, target, count, types, ownerIdOrName, operatorIdOrName } = ensureNotUndefined(
        request,
        ["target"],
      );

      // 账户主管理员模糊查询处理
      const { accountNames } = target[target.$case];
      let combineAccountNames: string[] | undefined = accountNames;

      if (ownerIdOrName) {
        const { accountNames: ownerAccountNames } = await getAccountNamesByUserIdOrName(
          em,
          ownerIdOrName,
          accountNames,
        );

        // 当accountNames和主管理员对应的账户名交集为空时，直接返回空数据
        if (ownerAccountNames.length === 0) {
          return; // 导出空结果
        }

        combineAccountNames = ownerAccountNames;
      }

      // 操作员模糊查询处理
      let operatorUserIds: string[] = [];
      if (operatorIdOrName?.trim()) {
        operatorUserIds = await getUserIdsByUserIdOrName(em, operatorIdOrName);
        if (operatorUserIds.length === 0) {
          return; // 导出空结果
        }
      }

      if (target?.$case === "accountsOfTenant") {
        target.accountsOfTenant.accountNames = combineAccountNames || [];
      }
      const searchTypes = getPaymentsSearchType(types);
      const searchParam = getPaymentsTargetSearchParam(target);

      // 构建查询条件
      const query: FilterQuery<PayRecord> = {
        time: { $gte: startTime!, $lte: endTime! },
        ...searchParam,
        ...searchTypes,
      };

      if (operatorUserIds?.length) {
        query.operatorId = { $in: operatorUserIds };
      }

      // 记录格式化函数
      const recordFormat = (x: Loaded<PayRecord, never>) => ({
        // 这里会先返回基础字段，账户主管理员和操作员会在后续添加
        tenantName: x.tenantName,
        accountName: x.accountName,
        amount: decimalToMoney(x.amount),
        comment: x.comment,
        index: x.id,
        ipAddress: x.ipAddress,
        time: x.time.toISOString(),
        type: x.type,
        operatorId: "",
        operatorName: "",
        ownerId: "",
        operatorIdAndName: "",
      });

      type RecordFormatReturnType = ReturnType<typeof recordFormat>;

      const batchSize = 5000;
      const writeBatchSize = 200; // 每次写入的批次大小
      let offset: number = 0;

      const { writeAsync } = createWriterExtensions(call);

      // 获取符合条件的总记录数
      const totalCount = await em.count(PayRecord, query);
      const exportCount = count && count > 0 ? Math.min(count, totalCount) : totalCount;

      while (offset < exportCount) {
        const limit = Math.min(batchSize, exportCount - offset);
        const payRecords = await em.find(PayRecord, query, {
          limit,
          offset,
        });

        if (payRecords.length === 0) {
          break;
        }

        // 获取操作员姓名映射
        const operatorIds = [...new Set(payRecords.map((r) => r.operatorId).filter(Boolean))];
        const operatorMap = await getUserNameMap(em, operatorIds);

        // 提取需要查询账户主管理员的账户标识
        const accountIdentifiers = payRecords
          .filter((record) => record.accountName && record.tenantName)
          .map((record) => ({
            tenantName: record.tenantName,
            accountName: record.accountName || "",
          }));

        const accountMap = await getAccountOwnerMap(em, accountIdentifiers);

        // 处理记录并添加账户主管理员和操作员信息
        const records: RecordFormatReturnType[] = payRecords.map((record) => {
          const formattedRecord = recordFormat(record);

          // 添加操作员
          formattedRecord.operatorId = record.operatorId;
          formattedRecord.operatorName = operatorMap.get(record.operatorId) || "";

          // 添加账户主管理员信息
          if (record.accountName && record.tenantName) {
            const key = `${record.tenantName}-${record.accountName}`;
            const accountInfo = accountMap.get(key);
            if (accountInfo?.owner) {
              formattedRecord.ownerId = `${accountInfo.owner.userName}(ID: ${accountInfo.owner.userId})`;
            }
          }

          return formattedRecord;
        });

        // 将记录按批次发送
        for (let i = 0; i < records.length; i += writeBatchSize) {
          const batchData = records.slice(i, i + writeBatchSize);

          await new Promise((resolve) => {
            void writeAsync({ payRecords: batchData });
            resolve("done");
          }).catch((e) => {
            throw {
              code: status.INTERNAL,
              message: "Error when exporting file",
              details: e?.message,
            } as ServiceError;
          });
        }
        offset += limit;
      }
    },

    exportBill: async (call) => {
      const { request, em } = call;
      const { accountNames, userIdsOrNames, termStart, termEnd, type, count, tenantName } = request;

      const knex = em.getKnex();
      let termArr: string[] = [];

      if (termStart && termEnd) {
        termArr = generateTermArray(termStart, termEnd, type);
      }

      const batchSize = 5000;
      let offset = 0;

      const { writeAsync } = createWriterExtensions(call);

      while (offset < count) {
        const limit = Math.min(batchSize, count - offset);

        let records: BillListItem[] | undefined = undefined;

        if (type === BillSearchType.SUMMARY) {
          const query = knex("account_bill as bill")
            .select([
              "bill.account_name as accountName",
              knex.raw("sum(bill.amount) as amount"),
              knex.raw("MIN(bill.tenant_name) as tenantName"),
              knex.raw("MIN(bill.account_owner_id) as accountOwnerId"),
              knex.raw("MIN(bill.account_owner_name) as accountOwnerName"),
              knex.raw("MIN(bill.create_time) as createTime"),
              knex.raw("MAX(bill.update_time) as updateTime"),
            ])
            .where("bill.type", BillType.MONTHLY)
            .modify((qb) => {
              buildQueryConditions(qb, { accountNames, userIdsOrNames, termArr, tenantName, termStart, termEnd, type });
            })
            .groupBy("bill.account_name")
            .limit(limit)
            .offset(offset);

          const result = await query;

          // 根据当前查询出来的账单账户，去查询所有月账单，将详情分别统计
          records = await processBillSummaries(em, result, termArr);
        } else {
          // 年、月账单的正常查询
          // 构建查询条件
          const sqlFilter = billFilter({ accountNames, userIdsOrNames, termArr, type, tenantName, termStart, termEnd });

          const items = await em.find(AccountBill, sqlFilter, {
            limit,
            offset,
            orderBy: { createTime: "desc" },
          });

          records = items.map((x) => {
            return {
              ...x,
              amount: decimalToMoney(x.amount),
              details: x.details ? x.details : {},
              createTime: x.createTime.toISOString(),
              updateTime: x.updateTime.toISOString(),
              ids: [x.id],
            };
          });
        }

        if (!records || records.length === 0) {
          break;
        }

        let data: BillListItem[] = [];

        // 记录传输的总数量
        let writeTotal = 0;

        for (const row of records) {
          data.push(row);
          writeTotal += 1;
          if (data.length === 200 || writeTotal === records.length) {
            await new Promise((resolve) => {
              void writeAsync({ bills: data });
              // 清空暂存
              data = [];
              resolve("done");
            }).catch((e) => {
              throw {
                code: status.INTERNAL,
                message: "Error when exporting file",
                details: e?.message,
              } as ServiceError;
            });
          }
        }
        offset += limit;
      }
    },

    exportUserBill: async (call) => {
      const { request, em } = call;
      const { accountBillIds } = request;

      const { writeAsync } = createWriterExtensions(call);

      let records: UserBillType[];

      const items = await em.find(
        UserBill,
        { accountBill: { $in: accountBillIds } },
        {
          orderBy: { createTime: "desc" },
        },
      );

      // 如果只传过来一个账户账单id，那说明不是汇总的数据，直接返回查询的结果
      if (accountBillIds.length === 1) {
        records = items.map((x) => {
          return {
            ...x,
            amount: decimalToMoney(x.amount),
            createTime: x.createTime.toISOString(),
          };
        });
      }

      // 如果是多条数据，根据查询到的数据items中 accountBill 中 userId 相等，合并数据
      records = mergeUserBillDetails(items);

      let data: UserBillType[] = [];

      // 记录传输的总数量
      let writeTotal = 0;

      for (const row of records) {
        data.push(row);
        writeTotal += 1;
        if (data.length === 200 || writeTotal === records.length) {
          await new Promise((resolve) => {
            void writeAsync({ userBills: data });
            // 清空暂存
            data = [];
            resolve("done");
          }).catch((e) => {
            throw {
              code: status.INTERNAL,
              message: "Error when exporting file",
              details: e?.message,
            } as ServiceError;
          });
        }
      }
    },

    exportJobRecord: async (call) => {
      const { request, em } = call;
      const { jobEndTimeStart, jobEndTimeEnd, target, count, clusters, userIdOrName, ownerIdOrName } =
        ensureNotUndefined(request, ["target"]);
      // 定义查询条件
      const targetSearchParam = getJobsTargetSearchParam(target);
      const { tenant: _targetTenant, ...searchParamWithoutTenant } = targetSearchParam;
      const searchParam = _targetTenant === "" ? searchParamWithoutTenant : targetSearchParam;

      const trimmedUserIdOrName = userIdOrName?.trim();
      const trimmedOwnerIdOrName = ownerIdOrName?.trim();

      let userMatchedUserIds: string[] | undefined = undefined;
      if (trimmedUserIdOrName) {
        const matchedUsers = await getUserIdsMatchedByUserIdOrName(em, trimmedUserIdOrName);
        const fixedUserId = typeof searchParam.user === "string" ? searchParam.user : undefined;
        userMatchedUserIds = fixedUserId ? (matchedUsers.includes(fixedUserId) ? [fixedUserId] : []) : matchedUsers;

        if (userMatchedUserIds.length === 0) {
          return;
        }
      }

      let ownerMatchedAccountNames: string[] | undefined = undefined;
      if (trimmedOwnerIdOrName) {
        const matchedAccounts = await getAccountNamesMatchedByOwner(em, trimmedOwnerIdOrName);
        const fixedAccountName = typeof searchParam.account === "string" ? searchParam.account : undefined;
        ownerMatchedAccountNames = fixedAccountName
          ? matchedAccounts.includes(fixedAccountName)
            ? [fixedAccountName]
            : []
          : matchedAccounts;

        if (ownerMatchedAccountNames.length === 0) {
          return;
        }
      }

      const query = {
        ...(jobEndTimeEnd || jobEndTimeStart
          ? {
              timeEnd: {
                ...(jobEndTimeStart ? { $gte: jobEndTimeStart } : {}),
                ...(jobEndTimeEnd ? { $lte: jobEndTimeEnd } : {}),
              },
            }
          : {}),
        ...searchParam,
        ...(clusters.length > 0 ? { cluster: clusters } : {}),
        ...(ownerMatchedAccountNames ? { account: { $in: ownerMatchedAccountNames } } : {}),
        ...(userMatchedUserIds ? { user: { $in: userMatchedUserIds } } : {}),
      };

      const recordFormat = (
        x: Loaded<JobInfo, never> & { userName: string; accountOwnerId?: string; accountOwnerName?: string },
      ) => ({
        idJob: x.idJob,
        jobName: x.jobName,
        account: x.account,
        user: x.user,
        accountPrice: decimalToMoney(x.accountPrice),
        cluster: x.cluster,
        partition: x.partition,
        qos: x.qos,
        timeSubmit: x.timeSubmit.toISOString(),
        timeEnd: x.timeEnd.toISOString(),
        biJobIndex: x.biJobIndex,
        nodelist: x.nodelist,
        timeStart: x.timeStart ? x.timeStart.toISOString() : undefined,
        gpu: x.gpu,
        cpusReq: x.cpusReq,
        memReq: x.memReq,
        nodesReq: x.nodesReq,
        cpusAlloc: x.cpusAlloc,
        memAlloc: x.memAlloc,
        nodesAlloc: x.nodesAlloc,
        timelimit: x.timelimit,
        timeUsed: x.timeUsed,
        timeWait: x.timeWait,
        recordTime: x.recordTime.toISOString(),
        tenantPrice: decimalToMoney(x.tenantPrice),
        userName: x.userName,
        accountOwnerId: x.accountOwnerId ?? "-",
        accountOwnerName: x.accountOwnerName ?? "-",
        tenantName: x.tenant,
      });

      type RecordFormatReturnType = ReturnType<typeof recordFormat>;

      const batchSize = 5000;
      let offset = 0;

      const { writeAsync } = createWriterExtensions(call);

      while (offset < count) {
        const limit = Math.min(batchSize, count - offset);

        // 先获取基础作业信息
        const records = await em.find(JobInfo, query, { limit, offset });
        const jobIds = records.map((job) => job.biJobIndex);

        // 获取用户姓名、账户主管理员ID和姓名的map
        let jobUserAndAccountOwnerDetailsMap: JobUserAndAccountOwnerDetailsMap = {};

        if (jobIds.length > 0) {
          jobUserAndAccountOwnerDetailsMap = await getJobUserAndAccountOwnerDetailsMap(em, jobIds);
        }

        // 将详细信息合并到记录中
        const recordsWithDetails = records.map((job) => {
          const detail = jobUserAndAccountOwnerDetailsMap[job.biJobIndex];
          return {
            ...job,
            userName: detail?.userName ?? "-",
            accountOwnerId: detail?.accountOwnerId ?? "-",
            accountOwnerName: detail?.accountOwnerName ?? "-",
          };
        });

        const formattedRecords = recordsWithDetails.map(recordFormat ?? ((x) => x));

        if (records.length === 0) {
          break;
        }

        let data: RecordFormatReturnType[] = [];
        // 记录传输的总数量
        let writeTotal = 0;

        for (const row of formattedRecords) {
          data.push(row);
          writeTotal += 1;
          if (data.length === 200 || writeTotal === formattedRecords.length) {
            await new Promise((resolve) => {
              void writeAsync({ jobRecords: data });
              // 清空暂存
              data = [];
              resolve("done");
            }).catch((e) => {
              throw {
                code: status.INTERNAL,
                message: "Error when exporting file",
                details: e?.message,
              } as ServiceError;
            });
          }
        }
        offset += limit;
      }
    },
  });
});
