import { ensureNotUndefined } from "@ddadaal/tsgrpc-server";
import { Loaded, MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
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
import { UserAccount, UserRole } from "src/entities/UserAccount";
import { UserBill } from "src/entities/UserBill";

dayjs.extend(timezone);

// 所有的作业费用更改产生的费用变化，合并为一个值，存入账单数据库中为${misConfig.changeJobPriceType}

export async function generateBill(
  em: SqlEntityManager<MySqlDriver>,
  type: BillType,
  logger: Logger,
  specifiedTerm?: string,
) {
  if (!misConfig.bill) {
    logger.info("No billing service configured");
    return;
  }

  const allUsers = await em.find(User, {}, { fields: ["userId", "name"] });

  const allUsersIdNameObj: Record<string, string> = allUsers.reduce((userObj: Record<string, string>, user) => {
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

  const accounts = await em.find(
    Account,
    {},
    {
      populate: ["tenant", "users", "users.user"],
      fields: ["accountName", "tenant", "users", "users.user", "users.role", "users.user.name", "users.user.userId"],
    },
  );
  const bills = await em.find(AccountBill, { term: term }, { fields: ["accountName"] });
  const alreadyExistsAccounts = new Set(bills.map((bill) => bill.accountName));

  for (const account of accounts) {
    if (alreadyExistsAccounts.has(account.accountName)) {
      continue;
    }

    const owner = account.users.getItems().find((x) => x.role === UserRole.OWNER);

    if (!owner) {
      logger.error("Account %s does not have an owner, do not generate bill", account.accountName);
      continue;
    }

    await generateAnAccountBill(
      em,
      account,
      term,
      startTimestamp,
      endTimestamp,
      type,
      owner,
      allUsersIdNameObj,
      logger,
    );
  }

  // 生成新的账单以后，需要删除数据库中存储的类型缓存，保证下次查询时可以查到所有的账单详情类型
  const queryCache = await em.findOne(QueryCache, { queryKey: "bill_type" });
  if (queryCache) {
    await em.removeAndFlush(queryCache);
  }

  logger.info(`Finished generating ${type} bills for term ${term}`);
}

async function generateAnAccountBill(
  em: SqlEntityManager<MySqlDriver>,
  account: Loaded<
    Account,
    "tenant" | "users" | "users.user",
    "tenant" | "users" | "users.user" | "accountName" | "users.role" | "users.user.name" | "users.user.userId",
    never
  >,
  term: string,
  startTimestamp: string,
  endTimestamp: string,
  type: BillType,
  owner: Loaded<UserAccount, "user", "user" | "role" | "user.name" | "user.userId", never>,
  allUsersIdNameObj: Record<string, string>,
  logger: Logger,
) {
  try {
    const ownerName = owner.user.getEntity().name;
    const ownerId = owner.user.getEntity().userId;

    const accountChargesRecord = await em.find(
      ChargeRecord,
      {
        accountName: account.accountName,
        time: { $gte: startTimestamp, $lte: endTimestamp },
      },
      {
        fields: ["amount", "userId", "type", "time"],
      },
    );

    const chargesRecord = accountChargesRecord
      .map((x) => ensureNotUndefined(x, ["time", "amount"]))
      .filter((r) => {
        return r.amount.gt(0);
      });

    // 筛选类型为作业费用更改的充值记录，这些费用将以负值的形式统计进作业费用当中
    const accountPayRecord = await em.find(
      PayRecord,
      {
        type: misConfig.changeJobPriceType,
        accountName: account.accountName,
        time: { $gte: startTimestamp, $lte: endTimestamp },
      },
      {
        fields: ["amount", "comment", "time"],
      },
    );

    const payRecord = accountPayRecord.map((x) => ensureNotUndefined(x, ["time", "amount"]));

    if (chargesRecord.length || payRecord.length) {
      // 将账单信息按照userId分成多个数组，没有id的消费记在账户拥有者上
      const userChagresRecordObj: Record<string, typeof chargesRecord> = chargesRecord.reduce(
        (userChagresRecord: Record<string, typeof chargesRecord>, record) => {
          const userId = record.userId || ownerId;
          userChagresRecord[userId] = userChagresRecord[userId] || [];
          userChagresRecord[userId].push(record);
          return userChagresRecord;
        },
        {},
      );
      // 将每个用户的消费类型按照不同的类型分别聚合统计
      const userChargesRecordTypeObj: Record<string, Record<string, Decimal>> = Object.keys(
        userChagresRecordObj,
      ).reduce((userChagresRecordType: Record<string, Record<string, Decimal>>, userId) => {
        userChagresRecordType[userId] = userChagresRecordObj[userId].reduce(
          (typeObj: Record<string, Decimal>, record) => {
            // 由于scow 允许增加type=""的消费记录，此处增加一个other的类型
            typeObj[record.type || misConfig.bill!.otherChargeTypeText] = (
              typeObj[record.type || misConfig.bill!.otherChargeTypeText] || Decimal(0)
            ).plus(record.amount);
            return typeObj;
          },
          {},
        );

        return userChagresRecordType;
      }, {});

      // 计算有多少个用户有消费，分别消费多少，如果有userId，视为当前userId，没有的话视为账户拥有者的支出
      const userIdAmountObj: Record<string, Decimal> = chargesRecord.reduce(
        (userIdObj: Record<string, Decimal>, record) => {
          userIdObj[record.userId || ownerId] = (userIdObj[record.userId || ownerId] || Decimal(0)).plus(record.amount);

          return userIdObj;
        },
        {},
      );

      // 根据费用类型进行归并
      const accountTypeAmountObj: Record<string, Decimal> = chargesRecord.reduce(
        (typeObj: Record<string, Decimal>, record) => {
          typeObj[record.type || misConfig.bill!.otherChargeTypeText] = (
            typeObj[record.type || misConfig.bill!.otherChargeTypeText] || Decimal(0)
          ).plus(record.amount);

          return typeObj;
        },
        {},
      );

      let accountAmount = Object.values(userIdAmountObj).reduce((sum, amount) => sum.plus(amount), Decimal(0));

      // 如果有充值记录，那么就要记录退费，充值记录中部分数据未记录用户id，这部分记在账户拥有者上，
      // 需要加默认赋值0，因为本月可能没有一分钱消费，但是调整了作业费用并进行了充值，
      // 临时使用属性名：jobRefundText
      if (payRecord.length) {
        const payAmount = payRecord.reduce((sum, r) => sum.plus(r.amount), Decimal(0));

        const userIdPayAmountObj: Record<string, Decimal> = payRecord.reduce(
          (userIdObj: Record<string, Decimal>, record) => {
            // 提取存在充值记录中的userId，如果没有，就计在账户拥有者上
            const jobUserId = record.comment?.split("job user ")[1] || ownerId;
            userIdObj[jobUserId] = (userIdObj[jobUserId] || Decimal(0)).plus(record.amount);
            return userIdObj;
          },
          {},
        );

        // 将退费金额计入个人用户的消费记录
        for (const key in userIdPayAmountObj) {
          if (userChargesRecordTypeObj[key]) {
            userChargesRecordTypeObj[key].jobRefund = userIdPayAmountObj[key];
          } else {
            userChargesRecordTypeObj[key] = { jobRefund: userIdPayAmountObj[key] };
          }
          userIdAmountObj[key] = (userIdAmountObj[key] || Decimal(0)).minus(userIdPayAmountObj[key]);
        }

        accountAmount = accountAmount.minus(payAmount);

        accountTypeAmountObj.jobRefund = payAmount;
      }

      // 将退费金额合并到作业费用更改中
      if (accountTypeAmountObj.jobRefund) {
        accountTypeAmountObj[misConfig.changeJobPriceType] = (
          accountTypeAmountObj[misConfig.changeJobPriceType] || Decimal(0)
        ).minus(accountTypeAmountObj.jobRefund);

        // 删掉退费金额这个属性
        delete accountTypeAmountObj.jobRefund;
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
        // 将退费金额合并到作业费用更改中
        if (userChargesRecordTypeObj[user].jobRefund) {
          userChargesRecordTypeObj[user][misConfig.changeJobPriceType] = (
            userChargesRecordTypeObj[user][misConfig.changeJobPriceType] || Decimal(0)
          ).minus(userChargesRecordTypeObj[user].jobRefund);

          // 删掉退费金额这个属性
          delete userChargesRecordTypeObj[user].jobRefund;
        }

        return new UserBill({
          tenantName: account.tenant.$.name,
          accountName: account.accountName,
          userId: user,
          name: allUsersIdNameObj[user],
          term,
          amount: userIdAmountObj[user],
          type,
          details: userChargesRecordTypeObj[user],
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
    em.clear();
    logger.info("The bill of account %s produced with %s", account.accountName, term);
  } catch (error) {
    logger.error("Failed to produce bill of account %s with %s", account.accountName, term);
    logger.error(error);
  }
}

export async function generateCustomTermBills(
  customTerms: string[],
  em: SqlEntityManager<MySqlDriver>,
  logger: Logger,
) {
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
