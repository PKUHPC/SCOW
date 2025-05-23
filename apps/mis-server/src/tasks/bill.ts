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

import { ensureNotUndefined } from "@ddadaal/tsgrpc-server";
import { MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
import { Decimal } from "@scow/lib-decimal";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import { Logger } from "pino";
import { misConfig } from "src/config/mis";
import { Account } from "src/entities/Account";
import { AccountBill, BillType } from "src/entities/AccountBill";
import { ChargeRecord } from "src/entities/ChargeRecord";
import { PayRecord } from "src/entities/PayRecord";
import { QueryCache } from "src/entities/QueryCache";
import { User } from "src/entities/User";
import { UserRole } from "src/entities/UserAccount";
import { UserBill } from "src/entities/UserBill";

dayjs.extend(timezone);

// 为避免引入退费金额这一新的理解逻辑，将退费的金额视为“作业费用更改2”，存入账单数据库中为：${misConfig.changeJobPriceType}2
// 而增加的叫“作业费用更改1”，存入账单数据库中为${misConfig.changeJobPriceType}1

export async function generateBill(em: SqlEntityManager<MySqlDriver>, type: BillType,
  logger: Logger, specifiedTerm?: string) {

  if (!misConfig.bill) {
    logger.info("No billing service configured");
    return;
  }

  const allUsers = await em.find(User, {}, { fields: ["userId", "name"]});

  const allUsersIdNameObj: Record<string, string> =
    allUsers.reduce((userObj: Record<string, string>, user) => {
      userObj[user.userId] = user.name;
      return userObj;
    }, {});

  const timeFormat = type === BillType.MONTHLY ? "YYYYMM" : "YYYY";
  const dateUnit = type === BillType.MONTHLY ? "month" : "year";

  let timePeriod = dayjs().tz("Asia/Shanghai").subtract(1, dateUnit);
  let startTimestamp = timePeriod.startOf(dateUnit).toISOString();
  let endTimestamp = timePeriod.endOf(dateUnit).toISOString();
  let term = timePeriod.format(timeFormat);

  if (specifiedTerm) {
    timePeriod = dayjs(specifiedTerm).tz("Asia/Shanghai");
    startTimestamp = timePeriod.startOf(dateUnit).toISOString();
    endTimestamp = timePeriod.endOf(dateUnit).toISOString();
    term = timePeriod.format(timeFormat);
  }

  logger.info(`Generating ${type} bills for term ${term}, start: ${startTimestamp}, end: ${endTimestamp}`);

  const accounts = await em.find(Account, {}, {
    populate: ["tenant", "users", "users.user"],
    fields: [
      "accountName",
      "tenant",
      "users",
      "users.user",
      "users.role",
      "users.user.name",
      "users.user.userId",
    ],
  });
  const bills = await em.find(AccountBill, { term: term }, { fields: ["accountName"]});
  const alreadyExistsAccounts = new Set(bills.map((bill) => bill.accountName));

  for (const account of accounts) {
    if (alreadyExistsAccounts.has(account.accountName)) {
      continue;
    }

    try {

      const owner = account.users.getItems().find((x) => x.role === UserRole.OWNER);

      if (!owner) {
        logger.error("Account %s does not have an owner, do not generate bill", account.accountName);
        continue;
      }

      const ownerName = owner.user.getEntity().name;
      const ownerId = owner.user.getEntity().userId;

      const accountChargesRecord = await em.find(ChargeRecord, {
        accountName: account.accountName,
        time: { $gte: startTimestamp, $lte: endTimestamp },
      }, {
        fields: ["amount", "userId", "type", "time"],
      });

      const chargesRecord = accountChargesRecord.map((x) => ensureNotUndefined(x, ["time", "amount"]))
        .filter((r) => { return r.amount.gt(0); });

      // 筛选类型为作业费用更改的充值记录，这些费用将以负值的形式统计进作业费用当中
      const accountPayRecord = await em.find(PayRecord, {
        type: misConfig.changeJobPriceType,
        accountName: account.accountName,
        time: { $gte: startTimestamp, $lte: endTimestamp },
      }, {
        fields: ["amount", "comment", "time"],
      });


      const payRecord = accountPayRecord.map((x) => ensureNotUndefined(x, ["time", "amount"]));

      if (payRecord.length) {
        logger.info("Account %s job payRecord: %o", account.accountName, payRecord);
      }

      if (chargesRecord.length || payRecord.length) {

        // 将账单信息按照userId分成多个数组，没有id的消费记在账户拥有者上
        const userChagresRecordObj: Record<string, typeof chargesRecord> =
          chargesRecord.reduce((userChagresRecord: Record<string, typeof chargesRecord>, record) => {
            const userId = record.userId || ownerId;
            userChagresRecord[userId] = userChagresRecord[userId] || [];
            userChagresRecord[userId].push(record);
            return userChagresRecord;
          }, {});

        // 将每个用户的消费类型按照不同的类型分别聚合统计
        const userChagresRecordTypeObj: Record<string, Record<string, Decimal>> =
          Object.keys(userChagresRecordObj).reduce((userChagresRecordType:
          Record<string, Record<string, Decimal>>, userId) => {

            userChagresRecordType[userId] = userChagresRecordObj[userId]
              .reduce((typeObj: Record<string, Decimal>, record) => {
                // 由于scow 允许增加type=""的消费记录，此处增加一个other的类型
                typeObj[record.type || misConfig.bill!.otherChargeTypeText] =
                  (typeObj[record.type || misConfig.bill!.otherChargeTypeText] || Decimal(0)).plus(record.amount);
                return typeObj;
              }, {});

            return userChagresRecordType;
          }, {});

        // 计算有多少个用户有消费，分别消费多少，如果有userId，视为当前userId，没有的话视为账户拥有者的支出
        const userIdAmountObj: Record<string, Decimal> =
          chargesRecord.reduce((userIdObj: Record<string, Decimal>, record) => {

            userIdObj[record.userId || ownerId] =
              (userIdObj[record.userId || ownerId] || Decimal(0)).plus(record.amount);

            return userIdObj;
          }, {});

        // 根据费用类型进行归并
        const accountTypeAmountObj: Record<string, Decimal> =
          chargesRecord.reduce((typeObj: Record<string, Decimal>, record) => {

            typeObj[record.type || misConfig.bill!.otherChargeTypeText] =
              (typeObj[record.type || misConfig.bill!.otherChargeTypeText] || Decimal(0)).plus(record.amount);

            return typeObj;
          }, {});

        let accountAmount = Object.values(userIdAmountObj)
          .reduce((sum, amount) => sum.plus(amount), Decimal(0));

        // 如果有充值记录，那么就要记录退费，充值记录中部分数据未记录用户id，这部分记在账户拥有者上，
        // 需要加默认赋值0，因为本月可能没有一分钱消费，但是调整了作业费用并进行了充值
        if (payRecord.length) {
          const payAmount = payRecord.reduce((sum, r) => sum.plus(r.amount), Decimal(0));

          const userIdPayAmountObj: Record<string, Decimal> =
            payRecord.reduce((userIdObj: Record<string, Decimal>, record) => {
              // 提取存在充值记录中的userId，如果没有，就计在账户拥有者上
              const jobUserId = record.comment?.split("job user ")[1] || ownerId;
              userIdObj[jobUserId] =
                (userIdObj[jobUserId] || Decimal(0)).plus(record.amount);
              return userIdObj;
            }, {});

          // 将退费金额计入个人用户的消费记录
          const jobRefundText = misConfig.changeJobPriceType + "2";
          for (const key in userIdPayAmountObj) {
            userChagresRecordTypeObj[key][jobRefundText] = userIdPayAmountObj[key];
            userIdAmountObj[key] = (userIdAmountObj[key] || Decimal(0)).minus(userIdPayAmountObj[key]);
          }

          accountAmount = accountAmount.minus(payAmount);

          accountTypeAmountObj[jobRefundText] = payAmount;
        }

        // 将属性 ${misConfig.changeJobPriceType} 改为 ${misConfig.changeJobPriceType}1
        if (accountTypeAmountObj[misConfig.changeJobPriceType]) {
          accountTypeAmountObj[misConfig.changeJobPriceType + "1"] = accountTypeAmountObj[misConfig.changeJobPriceType];
          delete accountTypeAmountObj[misConfig.changeJobPriceType];
        }

        // 插入账户账单数据
        const newAccountBill = new AccountBill({
          tenantName: account.tenant.$.name,
          accountName: account.accountName,
          accountOwnerId: ownerId,
          accountOwnerName: ownerName,
          term,
          type,
          amount: accountAmount,
          details: accountTypeAmountObj,
        });
        em.persist(newAccountBill);

        // 插入每个用户的支出情况，如果有userId，视为当前userId，没有的话视为账户拥有者的支出
        const userBills = Object.keys(userIdAmountObj).map((user) => {

          // 将属性 ${misConfig.changeJobPriceType} 改为 ${misConfig.changeJobPriceType}1
          if (userChagresRecordTypeObj[user][misConfig.changeJobPriceType]) {
            userChagresRecordTypeObj[user][misConfig.changeJobPriceType + "1"] =
              userChagresRecordTypeObj[user][misConfig.changeJobPriceType];

            delete userChagresRecordTypeObj[user][misConfig.changeJobPriceType];
          }

          return new UserBill({
            tenantName: account.tenant.$.name,
            accountName: account.accountName,
            userId: user,
            name: allUsersIdNameObj[user],
            term,
            amount: userIdAmountObj[user],
            type,
            details: userChagresRecordTypeObj[user],
            accountBill: newAccountBill,
          });
        });

        em.persist(userBills);

      } else {
        // 插入金额为0的账户账单数据
        const newAccountBill = new AccountBill({
          tenantName: account.tenant.$.name,
          accountName: account.accountName,
          accountOwnerId: ownerId,
          accountOwnerName: ownerName,
          term,
          amount: Decimal(0),
          type,
        });

        em.persist(newAccountBill);
      }

      await em.flush();
      logger.info("The bill of account %s produced with %s", account.accountName, term);
    } catch (error) {
      logger.info("Failed to produce bill of account %s with %s", account.accountName, term);
      logger.error(error);
    }
  }

  // 生成新的账单以后，需要删除数据库中存储的类型缓存，保证下次查询时可以查到所有的账单详情类型
  const queryCache = await em.findOne(QueryCache, { queryKey: "bill_type" });
  if (queryCache) {
    await em.removeAndFlush(queryCache);
  }

  logger.info(`Finished generating ${type} bills for term ${term}`);
}


export async function generateCustomTermBills(customTerms: string[],
  em: SqlEntityManager<MySqlDriver>, logger: Logger) {
  for (const term of customTerms) {
    const yearOnlyRegex = /^\d{4}$/; // 匹配 YYYY 格式
    const yearMonthRegex = /^\d{6}$/; // 匹配 YYYYMM 格式

    if (yearOnlyRegex.test(term)) {
      await generateBill(em, BillType.YEARLY, logger, term);
    }
    if (yearMonthRegex.test(term)) {
      await generateBill(em, BillType.MONTHLY, logger, term);
    }
  }

}

