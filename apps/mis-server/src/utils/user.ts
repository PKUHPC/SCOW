import { MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
import { User } from "src/entities/User";

// 根据userid或name模糊查询userid
export async function getUserIdsByUserIdOrName(
  em: SqlEntityManager<MySqlDriver>,
  userIdOrName: string,
): Promise<string[]> {
  const users = await em.find(User, {
    $or: [
      { userId: { $like: `%${userIdOrName}%` } },
      { name: { $like: `%${userIdOrName}%` } },
    ],
  }, {
    fields: ["userId"],
  });

  return users.map((user) => user.userId);
}

// 获取用户id-name映射
export async function getUserNameMap(
  em: SqlEntityManager<MySqlDriver>,
  userIds: string[],
): Promise<Map<string, string>> {
  if (userIds.length === 0) {
    return new Map();
  }

  const users = await em.find(User, { userId: { $in: userIds } }, {
    fields: ["userId", "name"],
  });

  return new Map(users.map((user) => [user.userId, user.name]));
}
