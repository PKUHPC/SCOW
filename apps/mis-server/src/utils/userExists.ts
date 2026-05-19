import { Logger } from "@ddadaal/tsgrpc-server";
import { MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
import { getCapabilities, getUser } from "@scow/lib-auth";
import { authUrl } from "src/config";
import { User } from "src/entities/User";

export async function userExists(userId: string, logger: Logger, em: SqlEntityManager<MySqlDriver>) {
  const capabilities = await getCapabilities(authUrl);
  // Check whether the user already exists in scow
  const user = await em.findOne(User, { userId });
  if (!capabilities.getUser) {
    // 如果不支持查询，则直接返回existsInAuth: undefined
    return {
      existsInScow: !!user,
      existsInAuth: undefined,
    };
  }
  const userInfo = await getUser(authUrl, { identityId: userId }, logger);
  return {
    existsInScow: !!user,
    existsInAuth: !!userInfo,
  };
}
