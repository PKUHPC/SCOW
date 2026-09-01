import { plugin } from "@ddadaal/tsgrpc-server";
import { decimalToMoney } from "@scow/lib-decimal";
import { BillServiceServer, BillServiceService, BillType as BillSearchType } from "@scow/protos/build/server/bill";
import { AccountBill, BillType } from "src/entities/AccountBill";
import { UserBill } from "src/entities/UserBill";
import {
  billFilter,
  buildQueryConditions,
  generateTermArray,
  mergeUserBillDetails,
  processBillSummaries,
  queryBillTypesCache,
} from "src/utils/bill";
import { paginationProps } from "src/utils/orm";

export const billServiceServer = plugin((server) => {
  server.addService<BillServiceServer>(BillServiceService, {
    getBills: async ({ request, em }) => {
      const { pageSize, page, accountNames, userIdsOrNames, termStart, termEnd, type, tenantName } = request;

      const knex = em.getKnex();
      let termArr: string[] = [];

      if (termStart && termEnd) {
        termArr = generateTermArray(termStart, termEnd, type);
      }

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
          .orderBy("bill.account_name", "asc")
          .limit(pageSize)
          .offset((page - 1) * pageSize);

        const result = await query;

        // 计算总数
        const countQuery = knex("account_bill as bill")
          .countDistinct("bill.account_name as count")
          .where({ "bill.type": BillType.MONTHLY })
          .modify((qb) => {
            buildQueryConditions(qb, { accountNames, userIdsOrNames, termArr, tenantName, termStart, termEnd, type });
          });

        const countResult = await countQuery;
        const count = countResult[0].count as number;

        // 根据当前查询出来的账单账户，去查询所有月账单，将详情分别统计
        const items = await processBillSummaries(em, result, termArr);

        return [
          {
            bills: items,
            total: count,
          },
        ];
      } else {
        // 年、月账单的正常查询
        // 构建查询条件
        const sqlFilter = billFilter({ accountNames, userIdsOrNames, termArr, type, tenantName, termStart, termEnd });

        const [items, count] = await em.findAndCount(AccountBill, sqlFilter, {
          ...paginationProps(page, pageSize),
          orderBy: { term: "desc", accountName: "asc" },
        });

        return [
          {
            bills: items.map((x) => {
              return {
                ...x,
                amount: decimalToMoney(x.amount),
                details: x.details ?? {},
                createTime: x.createTime.toISOString(),
                updateTime: x.updateTime.toISOString(),
                ids: [x.id], // 对于非 SUMMARY 类型，只包含单个 id
              };
            }),
            total: count,
          },
        ];
      }
    },

    getUserBills: async ({ request, em }) => {
      const { accountBillIds, accountName } = request;

      const items = await em.find(
        UserBill,
        { accountBill: { $in: accountBillIds }, ...(accountName ? { accountName } : {}) },
        {
          orderBy: { userId: "asc" },
        },
      );

      // 如果只传过来一个账户账单id，那说明不是汇总的数据，直接返回查询的结果
      if (accountBillIds.length === 1) {
        return [
          {
            userBills: items.map((x) => {
              return {
                ...x,
                details: x.details ?? {},
                amount: decimalToMoney(x.amount),
                createTime: x.createTime.toISOString(),
              };
            }),
          },
        ];
      }

      // 如果是多条数据，根据查询到的数据items中 accountBill 中 userId 相等，合并数据
      const results = mergeUserBillDetails(items);

      return [{ userBills: results }];
    },

    getBillTypes: async ({ em }) => {
      const types: string[] = await queryBillTypesCache(em);
      return [{ types }];
    },
  });
});
