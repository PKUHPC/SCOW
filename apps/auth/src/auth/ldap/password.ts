import { BerWriter } from "asn1";
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

export async function modifyPasswordBase(
  userId: string,
  oldPassword: string | undefined,
  newPassword: string,
  client: ldapjs.Client,
): Promise<boolean> {
  /** Must bind as the user whose password is to be changed and then password can be changed */
  try {
    const CTX_SPECIFIC_CLASS = 0b10 << 6;
    const writer = new BerWriter();
    writer.startSequence();
    writer.writeString(userId, CTX_SPECIFIC_CLASS | 0); // sequence item number 0
    if (oldPassword) {
      writer.writeString(oldPassword, CTX_SPECIFIC_CLASS | 1); // sequence item number 1
    }
    writer.writeString(newPassword, CTX_SPECIFIC_CLASS | 2); // sequence item number 2
    writer.endSequence();

    await promisify(client.exop.bind(client))("1.3.6.1.4.1.4203.1.11.1", writer.buffer);
    return true;
  } catch (e: any) {
    return handleIfInvalidCredentials(e);
  }
}

export async function checkPassword(
  log: FastifyBaseLogger,
  ldap: LdapConfigSchema,
  userDn: string,
  password: string,
): Promise<boolean> {
  try {
    return await useLdap(log, ldap, { dn: userDn, password })(async () => {
      return true;
    });
  } catch (e: any) {
    return handleIfInvalidCredentials(e);
  }
}

// Login as self and modify anyone's password
export async function modifyPassword(
  log: FastifyBaseLogger,
  ldap: LdapConfigSchema,
  userDn: string,
  newPassword: string,
): Promise<boolean> {
  return await useLdap(log, ldap, { dn: ldap.bindDN, password: ldap.bindPassword })(async (client) => {
    await modifyPasswordBase(userDn, undefined, newPassword, client);
    return true;
  });
}

// Login as self and modify self password

export async function modifyForceFlagBase(
  userId: string,
  forceFlag: boolean,
  client: ldapjs.Client,
  ldap: LdapConfigSchema,
): Promise<boolean> {
  try {
    const modify = promisify(client.modify.bind(client));
    if (ldap.ppolicy?.pwdMustChangeAtFirstLoginOrResetByAdmin || !forceFlag) {
      await modify(
        userId,
        new ldapjs.Change({
          operation: "replace",
          modification: {
            pwdReset: forceFlag ? "TRUE" : "FALSE",
          },
        }),
      );
    }
    return true;
  } catch (e: any) {
    return handleIfInvalidCredentials(e);
  }
}

export async function modifyForceFlag(
  log: FastifyBaseLogger,
  ldap: LdapConfigSchema,
  userDn: string,
  forceFlag: boolean,
): Promise<boolean> {
  try {
    return await useLdap(
      log,
      ldap,
    )(async (client) => {
      await modifyForceFlagBase(userDn, forceFlag, client, ldap);
      return true;
    });
  } catch (e: any) {
    return handleIfInvalidCredentials(e);
  }
}
