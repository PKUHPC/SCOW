import { MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
import { Account } from "src/entities/Account";
import { UserRole as EntityUserRole } from "src/entities/UserAccount";

// 根据主管理员id或name模糊查询对应账户名
export async function getAccountNamesByUserIdOrName(
  em: SqlEntityManager<MySqlDriver>,
  ownerIdOrName: string,
  // 搜索条件中的账户名，用于和主管理员对应的账户名取交集
  // 当accountNames为空时，代表查所有。直接取主管理员对应的账户名
  accountNames?: string[],
): Promise<{ accountNames: string[] }> {
  const qbAccount = em
    .createQueryBuilder(Account, "a")
    .select(["a.id", "a.accountName"])
    .leftJoin("a.users", "ua")
    .leftJoin("ua.user", "u")
    .where({ "ua.role": EntityUserRole.OWNER })
    .andWhere({
      $or: [{ "u.userId": { $like: `%${ownerIdOrName}%` } }, { "u.name": { $like: `%${ownerIdOrName}%` } }],
    });

  const accountForOwners = await qbAccount.getResult();

  const filteredAccounts = accountForOwners.filter((i) => {
    if (accountNames && accountNames.length > 0) {
      return accountNames.includes(i.accountName);
    }
    return true;
  });

  return {
    accountNames: filteredAccounts.map((item) => item.accountName),
  };
}

// 查询账户主管理员映射
export async function getAccountOwnerMap(
  em: SqlEntityManager<MySqlDriver>,
  accountIdentifiers: { tenantName: string; accountName: string }[],
): Promise<Map<string, any>> {
  if (accountIdentifiers.length === 0) {
    return new Map();
  }

  const qb = em
    .createQueryBuilder(Account, "a")
    .select([
      "a.accountName",
      "t.name as tenantName",
      "ua.role as userRole",
      "u.user_id as userId",
      "u.name as userName",
    ])
    .leftJoin("a.users", "ua", { "ua.role": EntityUserRole.OWNER })
    .leftJoin("ua.user", "u")
    .leftJoin("a.tenant", "t")
    .where({ "ua.role": EntityUserRole.OWNER })
    .andWhere({
      "a.accountName": {
        $in: [...new Set(accountIdentifiers.map((a) => a.accountName))],
      },
    })
    .andWhere({
      "t.name": {
        $in: [...new Set(accountIdentifiers.map((a) => a.tenantName))],
      },
    });

  const accountsWithOwners: {
    accountName?: string;
    tenantName?: string;
    userRole?: string;
    userId?: string;
    userName?: string;
  }[] = await qb.execute("all");

  const accountMap = new Map();
  accountsWithOwners.forEach((account) => {
    if (account.accountName && account.tenantName) {
      const key = `${account.tenantName}-${account.accountName}`;
      accountMap.set(key, {
        owner: account,
      });
    }
  });

  return accountMap;
}
