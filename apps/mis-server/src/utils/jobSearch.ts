import { MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
import { UserRole } from "src/entities/UserAccount";

export function escapeLikePattern(input: string): string {
  // Use '!' as LIKE escape character to avoid backslash mode differences.
  return input.replace(/!/g, "!!").replace(/%/g, "!%").replace(/_/g, "!_");
}

export async function getAccountNamesMatchedByOwner(
  em: SqlEntityManager<MySqlDriver>,
  ownerIdOrName: string,
): Promise<string[]> {
  const knex = em.getConnection().getKnex();
  const keyword = `%${escapeLikePattern(ownerIdOrName)}%`;
  const rows = await knex
    .from({ a: "account" })
    .distinct("a.account_name as accountName")
    .innerJoin({ ua: "user_account" }, "ua.account_id", "a.id")
    .innerJoin({ u: "user" }, "u.id", "ua.user_id")
    .where("ua.role", UserRole.OWNER)
    .andWhere((qb) => {
      qb.whereRaw("u.user_id LIKE ? ESCAPE '!'", [keyword]).orWhereRaw("u.name LIKE ? ESCAPE '!'", [keyword]);
    });

  return rows.map((row) => String(row.accountName)).filter((accountName) => accountName.length > 0);
}

export async function getUserIdsMatchedByUserIdOrName(
  em: SqlEntityManager<MySqlDriver>,
  userIdOrName: string,
): Promise<string[]> {
  const keyword = `%${escapeLikePattern(userIdOrName)}%`;
  const rows = await em
    .getConnection()
    .getKnex()
    .from({ u: "user" })
    .select("u.user_id as userId")
    .where((qb) => {
      qb.whereRaw("u.user_id LIKE ? ESCAPE '!'", [keyword]).orWhereRaw("u.name LIKE ? ESCAPE '!'", [keyword]);
    });

  return rows.map((row) => String(row.userId)).filter((userId) => userId.length > 0);
}
