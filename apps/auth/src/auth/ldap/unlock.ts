import { FastifyBaseLogger } from "fastify";
import ldapjs from "ldapjs";
import { useLdap } from "src/auth/ldap/helpers";
import { LdapConfigSchema } from "src/config/auth";
import { promisify } from "util";

function handleIfInvalidCredentials(e: any) {
  if (e.message === "Invalid Credentials") {
    return false;
  } else {
    throw e;
  }
}

export async function modifyUnlockBase(
  userId: string,
  client: ldapjs.Client,
): Promise<boolean> {
  try {
    const modify = promisify(client.modify.bind(client));

    await modify(userId, new ldapjs.Change({
      operation: "delete",
      modification: {
        "pwdAccountLockedTime": [], // 值留空表示删除整个属性
      },
    }));

    return true;
  } catch (e: any) {
    if (e.message.includes("no such attribute")) {
      return true;
    }
    return handleIfInvalidCredentials(e);
  }
}

export async function modifyUnlock(
  log: FastifyBaseLogger,
  ldap: LdapConfigSchema,
  userDn: string,
): Promise<boolean> {
  try {
    return await useLdap(log, ldap)(async (client) => {
      await modifyUnlockBase(userDn, client);
      return true;
    });
  } catch (e: any) {
    return handleIfInvalidCredentials(e);
  }
}