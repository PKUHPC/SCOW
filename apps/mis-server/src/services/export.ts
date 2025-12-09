import { createWriterExtensions, ServiceError } from "@ddadaal/tsgrpc-common";
import { ensureNotUndefined, plugin } from "@ddadaal/tsgrpc-server";
import { status } from "@grpc/grpc-js";
import { Loaded } from "@mikro-orm/core";
import { decimalToMoney } from "@scow/lib-decimal";
import { account_AccountStateFromJSON } from "@scow/protos/build/server/account";
import { BillListItem, BillType as BillSearchType, UserBill as UserBillType } from "@scow/protos/build/server/bill";
import {
  ExportServiceServer,
  ExportServiceService } from "@scow/protos/build/server/export";
import {
  platformRoleFromJSON,
  platformRoleToJSON, SortDirection, tenantRoleFromJSON, tenantRoleToJSON } from "@scow/protos/build/server/user";
import { Account, AccountState } from "src/entities/Account";
import { AccountBill, BillType } from "src/entities/AccountBill";
import { ChargeRecord } from "src/entities/ChargeRecord";
import { JobInfo } from "src/entities/JobInfo";
import { PayRecord } from "src/entities/PayRecord";
import { User } from "src/entities/User";
import { UserRole, UserStatus } from "src/entities/UserAccount";
import { UserBill } from "src/entities/UserBill";
import { getAccountStateInfo } from "src/utils/accountUserState";
import { billFilter, buildQueryConditions,generateTermArray, mergeUserBillDetails, processBillSummaries,
} from "src/utils/bill";
import {
  getChargesSearchType,
  getChargesSearchTypes,
  getChargesTargetSearchParam,
  getPaymentsSearchType,
  getPaymentsTargetSearchParam,
} from "src/utils/chargesQuery";
import {
  getJobsTargetSearchParam,
  getJobUserAndAccountOwnerDetailsMap,
  JobUserAndAccountOwnerDetailsMap,
} from "src/utils/job";
import { logger } from "src/utils/logger";
import { mapUsersSortField } from "src/utils/queryOptions";


export const exportServiceServer = plugin((server) => {

  server.addService<ExportServiceServer>(ExportServiceService, {

    exportUser: async (call) => {
      const { request, em } = call;
      const {
        sortField,
        sortOrder,
        idOrName,
        tenantName,
        tenantRole,
        platformRole,
        count,
      } = request;

      const platformRoleQuery = platformRole !== undefined ? {
        platformRoles: { $like: `%${platformRoleToJSON(platformRole)}%` },
      } : {};

      const tenantRoleQuery = tenantRole !== undefined ? {
        tenantRoles: { $like: `%${tenantRoleToJSON(tenantRole)}%` },
      } : {};

      const tenantNameQuery = tenantName !== undefined ? {
        tenant: { name: tenantName },
      } : {};

      const idOrNameQuery = idOrName ? {
        $or: [
          { userId: { $like: `%${idOrName}%` } },
          { name: { $like: `%${idOrName}%` } },
        ],
      } : {};

      const query = {
        $and: [
          platformRoleQuery,
          tenantRoleQuery,
          tenantNameQuery,
          idOrNameQuery,
        ],
      };

      const recordFormat = (x: Loaded<User, "tenant" | "accounts" | "accounts.account">) => ({
        userId: x.userId,
        name: x.name,
        email: x.email,
        phone: x.phone,
        organization: x.organization,
        adminComment: x.adminComment,
        availableAccounts: x.accounts.getItems()
          .filter((ua) => ua.blockedInCluster === UserStatus.UNBLOCKED)
          .map((ua) => {
            return ua.account.getProperty("accountName");
          }),
        affiliatedAccounts: x.accounts.getItems()
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
        const records = ((await em.find(User, query, {
          limit, offset,
          orderBy: (sortField !== undefined && sortOrder !== undefined) ?
            { [mapUsersSortField[sortField]]: sortOrder === SortDirection.ASC ? "ASC" : "DESC" } : undefined,
          populate: ["tenant", "accounts", "accounts.account"]}))
          .map(recordFormat ?? ((x) => x)));

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
      const {
        tenantName,
        accountName,
        blocked,
        debt,
        frozen,
        normal,
        deleted,
        count,
        ownerIdOrName,
      } = request;

      const recordFormat = (x: Loaded<Account, "tenant" | "users" | "users.user">) => {

        const owner = x.users.getItems().find((x) => x.role === UserRole.OWNER);

        if (!owner) {
          accountsWithoutOwner.push(x.accountName);
        }

        const ownerUser = owner?.user.getEntity();

        const blockThresholdAmount = x.blockThresholdAmount ?? x.tenant.$.defaultAccountBlockThreshold;
        const exportedState =
          getAccountStateInfo(x.whitelist?.id, x.state, x.balance, blockThresholdAmount).displayedState;

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
          `Found accounts without an owner. Accounts: ${accountsWithoutOwner.join(",")}. `
            + "The items will be displayed as \"-\" in the exported file.");
      }

      type RecordFormatReturnType = ReturnType<typeof recordFormat>;
      const batchSize = 5000;
      let offset = 0;

      const { writeAsync } = createWriterExtensions(call);

      const baseQb = em.createQueryBuilder(Account, "a")
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
        void baseQb.andWhere({ "a.state": AccountState.NORMAL })
          .andWhere("a.whitelist_id IS NULL")
          .andWhere("CASE WHEN a.block_threshold_amount IS NOT NULL"
            + " THEN a.balance <= a.block_threshold_amount ELSE a.balance <= t.default_account_block_threshold END");
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
        knexQuery.andWhere(function() {
          this.where("u.user_id", "like", `%${ownerIdOrName}%`)
            .orWhere("u.name", "like", `%${ownerIdOrName}%`);
        });
      }

      while (offset < count) {
        const qb = baseQb.clone();
        const limit = Math.min(batchSize, count - offset);

        const queryResult = await qb
          .limit(limit)
          .offset(offset)
          .getResultList() as Loaded<Account, "tenant" | "users" | "users.user">[];

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
      const {
        startTime,
        endTime,
        type,
        types,
        target,
        count,
        userIds,
      } = request;

      const searchParam = getChargesTargetSearchParam(target);
      const searchType = types.length === 0 ? getChargesSearchType(type) : getChargesSearchTypes(types);
      const query = {
        time: { $gte: startTime, $lte: endTime },
        ...searchType,
        ...searchParam,
        ...(userIds.length > 0 ? { userId: { $in: userIds } } : {}),
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

        const records = (await em.find(ChargeRecord, query, { limit, offset }))
          .map(recordFormat ?? ((x) => x));

        if (records.length === 0) {
          break;
        }

        await writeAsync({ chargeRecords: records });

        offset += limit;
      }
    },

    exportPayRecord: async (call) => {
      const { request, em } = call;
      const {
        startTime,
        endTime,
        target,
        count,
        types,
      } = ensureNotUndefined(request, ["target"]);
      const searchParam = getPaymentsTargetSearchParam(target);
      const searchTypes = getPaymentsSearchType(types);
      const query: { time: { $gte: string; $lte: string }; [key: string]: any } = {
        time: { $gte: startTime!, $lte: endTime! },
        ...searchParam,
        ...searchTypes,
      };
      // type并非仅有一个空字符串时，增加type条件
      const recordFormat = (x: Loaded<PayRecord, never>) => ({
        tenantName: x.tenantName,
        accountName: x.accountName,
        amount: decimalToMoney(x.amount),
        comment: x.comment,
        index: x.id,
        ipAddress: x.ipAddress,
        time: x.time.toISOString(),
        type: x.type,
        operatorId: x.operatorId,
      });

      type RecordFormatReturnType = ReturnType<typeof recordFormat>;

      const batchSize = 5000;
      let offset = 0;

      const { writeAsync } = createWriterExtensions(call);

      while (offset < count) {
        const limit = Math.min(batchSize, count - offset);
        const records = (await em.find(PayRecord, query, { limit, offset }))
          .map(recordFormat ?? ((x) => x));

        if (records.length === 0) {
          break;
        }

        let data: RecordFormatReturnType[] = [];
        // 记录传输的总数量
        let writeTotal = 0;

        for (const row of records) {
          data.push(row);
          writeTotal += 1;
          if (data.length === 200 || writeTotal === records.length) {
            await new Promise((resolve) => {
              void writeAsync({ payRecords: data });
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

    exportBill: async (call) => {
      const { request, em } = call;
      const {
        accountNames, userIdsOrNames, termStart, termEnd, type, count, tenantName,
      } = request;

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

      const items = await em.find(UserBill, { accountBill: { $in: accountBillIds } }, {
        orderBy: { createTime: "desc" },
      });

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
      const {
        jobEndTimeStart,
        jobEndTimeEnd,
        target,
        count,
        clusters,
      } = ensureNotUndefined(request, ["target"]);
      // 定义查询条件
      const searchParam = getJobsTargetSearchParam(target);
      const query = {
        ...(jobEndTimeEnd || jobEndTimeStart) ? {
          timeEnd: {
            ...jobEndTimeStart ? { $gte: jobEndTimeStart } : {},
            ...jobEndTimeEnd ? { $lte: jobEndTimeEnd } : {},
          },
        } : {},
        ...searchParam,
        ...clusters.length > 0 ? { cluster: clusters } : {},
      };

      const recordFormat = (x: Loaded<JobInfo, never>
         & { userName: string; accountOwnerId?: string; accountOwnerName?: string; }) => ({
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
        biJobIndex:x.biJobIndex,
        nodelist:x.nodelist,
        timeStart:x.timeStart ? x.timeStart.toISOString() : undefined,
        gpu:x.gpu,
        cpusReq:x.cpusReq,
        memReq:x.memReq,
        nodesReq:x.nodesReq,
        cpusAlloc:x.cpusAlloc,
        memAlloc:x.memAlloc,
        nodesAlloc:x.nodesAlloc,
        timelimit:x.timelimit,
        timeUsed:x.timeUsed,
        timeWait:x.timeWait,
        recordTime:x.recordTime.toISOString(),
        tenantPrice:decimalToMoney(x.tenantPrice),
        userName: x.userName,
        accountOwnerId: x.accountOwnerId ?? "-",
        accountOwnerName: x.accountOwnerName ?? "-",
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

        // 获取用户姓名、账户拥有者ID和姓名的map
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
