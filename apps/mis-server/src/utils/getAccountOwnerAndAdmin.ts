import { Logger } from "@ddadaal/tsgrpc-server";
import { SqlEntityManager } from "@mikro-orm/mysql";
import { UserRole } from "@scow/protos/build/server/user";
import { UserAccount } from "src/entities/UserAccount";

export async function getAccountOwnerAndAdmin(accountName: string, logger: Logger, em: SqlEntityManager) {
  const accountUsers = await em.find(UserAccount, { account: { accountName } }, { populate: ["user"] });

  return accountUsers
    .filter((x) => UserRole[x.role] !== UserRole.USER)
    .map((x) => {
      return {
        userId: x.user.$.userId,
        name: x.user.$.name,
      };
    });
}
