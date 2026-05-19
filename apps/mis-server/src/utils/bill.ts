import { EntityManager, Knex, Loaded, MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
import { Decimal, decimalToMoney } from "@scow/lib-decimal";
import {
  BillListItem,
  BillType as BillSearchType,
  billTypeToJSON,
  UserBill as UserBillType,
} from "@scow/protos/build/server/bill";
import dayjs from "dayjs";
import { config } from "src/config/env";
import { misConfig } from "src/config/mis";
import { AccountBill, BillType } from "src/entities/AccountBill";
import { QueryCache } from "src/entities/QueryCache";
import { UserBill } from "src/entities/UserBill";

export const queryBillTypesCache = async (em: SqlEntityManager<MySqlDriver>) => {
  const queryKey = "bill_type";
  const queryCache = await em.findOne(QueryCache, { queryKey });
  if (queryCache) {
    return JSON.parse(queryCache.queryResult) as string[];
  } else {
    const uniqueKeys = new Set<string>();
    // 预先添加作业费用及作业费用更改两种类型，使其排序在前
    uniqueKeys.add(misConfig.jobChargeType).add(misConfig.changeJobPriceType);

    if (config.QUANTUM_DEPLOYED) {
      uniqueKeys.add(misConfig.quantumJobChargeType);
    }

    const results = await em.getConnection().execute("SELECT details FROM account_bill WHERE details IS NOT NULL");

    results.forEach((row) => {
      Object.keys(row.details).forEach((key) => {
        uniqueKeys.add(key);
      });
    });

    // 将其它类型移至最后
    if (misConfig.bill?.otherChargeTypeText && uniqueKeys.has(misConfig.bill.otherChargeTypeText)) {
      uniqueKeys.delete(misConfig.bill.otherChargeTypeText);
      uniqueKeys.add(misConfig.bill.otherChargeTypeText);
    }

    const billDetailTypes = [...uniqueKeys];
    const newQueryCache = new QueryCache({
      queryKey,
      queryResult: JSON.stringify(billDetailTypes),
      timestamp: new Date(),
    });
    await em.persistAndFlush(newQueryCache);
    return billDetailTypes;
  }
};

export function generateTermArray(termStart: string, termEnd: string, type: BillSearchType): string[] {
  if (type === BillSearchType.YEARLY) {
    return generateYearsArray(termStart, termEnd);
  } else {
    return generateMonthsArray(termStart, termEnd);
  }
}

export function generateMonthsArray(termStart: string, termEnd: string): string[] {
  const start = dayjs(termStart, "YYYYMM");
  const end = dayjs(termEnd, "YYYYMM");
  const months: string[] = [];

  let current = start;

  while (current.isBefore(end) || current.isSame(end)) {
    months.push(current.format("YYYYMM"));
    current = current.add(1, "month");
  }

  return months;
}

export function generateYearsArray(termStart: string, termEnd: string): string[] {
  const start = dayjs(termStart, "YYYY");
  const end = dayjs(termEnd, "YYYY");
  const years: string[] = [];

  let current = start;

  while (current.isBefore(end) || current.isSame(end)) {
    years.push(current.format("YYYY"));
    current = current.add(1, "year");
  }

  return years;
}

interface QueryCondition {
  accountNames: string[];
  userIdsOrNames?: string;
  termArr: string[];
  tenantName?: string;
  type: BillSearchType;
  termStart?: string;
  termEnd?: string;
}

export function buildQueryConditions(qb: Knex.QueryBuilder, conditions: QueryCondition): void {
  const { accountNames, userIdsOrNames, termArr, tenantName, termStart, termEnd } = conditions;
  if (accountNames.length) {
    qb.andWhere("bill.account_name", "in", accountNames);
  }
  if (userIdsOrNames) {
    const idsOrNamesArray = userIdsOrNames.split(",").map((s) => s.trim());
    qb.andWhere((builder) => {
      builder.whereIn("bill.account_owner_id", idsOrNamesArray).orWhereIn("bill.account_owner_name", idsOrNamesArray);
    });
  }
  if (termStart && termEnd) {
    qb.andWhere("bill.term", "in", termArr);
  }
  if (tenantName) {
    qb.andWhere("bill.tenant_name", tenantName);
  }
}

interface BillSummary {
  accountName: string;
  tenantName: string;
  accountOwnerId?: string;
  accountOwnerName?: string;
  amount: string; // Assuming the amount is a string that can be converted to Decimal
  createTime: string;
  updateTime: string;
}

export async function processBillSummaries(
  em: EntityManager,
  results: BillSummary[],
  termArr: string[],
): Promise<BillListItem[]> {
  const records: BillListItem[] = [];

  for (const summary of results) {
    const relatedBills = await em.find(AccountBill, {
      term: { $in: termArr },
      accountName: summary.accountName,
      type: BillType.MONTHLY,
    });

    const mergedDetails = mergeBillDetails(relatedBills);

    records.push({
      accountName: summary.accountName,
      tenantName: summary.tenantName,
      accountOwnerId: summary.accountOwnerId,
      accountOwnerName: summary.accountOwnerName,
      amount: decimalToMoney(new Decimal(summary.amount)),
      createTime: summary.createTime,
      updateTime: summary.updateTime,
      details: mergedDetails,
      ids: relatedBills.map((bill) => bill.id),
      id: relatedBills[0]?.id,
      type: "SUMMARY",
      term: termArr.length > 1 ? termArr[0] + "-" + termArr[termArr.length - 1] : termArr[0],
    });
  }

  return records;
}

function mergeBillDetails(bills: AccountBill[]): Record<string, number> {
  const details: Record<string, Decimal> = {};
  for (const bill of bills) {
    if (bill.details) {
      // bill.details = JSON.parse(bill.details);
      for (const [key, value] of Object.entries(bill.details)) {
        if (!details[key]) {
          details[key] = new Decimal(0);
        }
        details[key] = details[key].plus(new Decimal(Number(value)));
      }
    }
  }
  return Object.fromEntries(Object.entries(details).map(([key, value]) => [key, value.toNumber()]));
}

export function billFilter({ accountNames, userIdsOrNames, termArr, type, tenantName, termStart, termEnd }) {
  const idsOrNamesArray = userIdsOrNames ? userIdsOrNames.split(",").map((s) => s.trim()) : [];

  return {
    ...(accountNames.length > 0 ? { accountName: { $in: accountNames } } : {}),
    ...(idsOrNamesArray.length > 0
      ? {
          $or: [{ accountOwnerId: { $in: idsOrNamesArray } }, { accountOwnerName: { $in: idsOrNamesArray } }],
        }
      : {}),
    ...(termStart && termEnd ? { term: { $in: termArr } } : {}),
    ...(type ? { type: billTypeToJSON(type) } : {}),
    ...(tenantName ? { tenantName } : {}),
  };
}

export function mergeUserBillDetails(items: Loaded<UserBill>[]): UserBillType[] {
  const userBillSummary: Record<string, UserBill> = {};

  for (const item of items) {
    const userId = item.userId;
    if (!userBillSummary[userId]) {
      userBillSummary[userId] = {
        ...item,
        amount: Decimal(item.amount || 0),
        details: item.details || {},
      };
      continue;
    }

    userBillSummary[userId].amount = userBillSummary[userId].amount.plus(item.amount);

    // 合并 details
    for (const [key, value] of Object.entries(item.details || {})) {
      userBillSummary[userId].details[key] = Decimal(userBillSummary[userId].details[key] || 0)
        .plus(Decimal(Number(value)))
        .toNumber();
    }
  }

  // 格式化结果
  return Object.values(userBillSummary).map((summary) => ({
    ...summary,
    amount: decimalToMoney(summary.amount),
    details: summary.details,
    createTime: summary.createTime.toISOString(),
  }));
}
