import { FastifyBaseLogger } from "fastify";
import ldapjs from "ldapjs";
import { useLdap } from "src/auth/ldap/helpers";
import { LdapConfigSchema } from "src/config/auth";
import { promisify } from "util";

export async function modifyPPolicy(
  log: FastifyBaseLogger,
  ldap: LdapConfigSchema,
): Promise<boolean> {
  return await useLdap(log, ldap)(async (client) => {
    const modify = promisify(client.modify.bind(client));

    if (ldap.ppolicy?.defaultOlcPPolicyDn) {
      try {
        if (typeof ldap.ppolicy?.pwdMaxFailures === "number" && ldap.ppolicy.pwdMaxFailures > 0) {
          await modify(ldap.ppolicy.defaultOlcPPolicyDn, new ldapjs.Change({
            operation: "replace",
            modification: {
              pwdMaxFailure: ldap.ppolicy.pwdMaxFailures,
            },
          }));
        } else {
          await modify(ldap.ppolicy.defaultOlcPPolicyDn, new ldapjs.Change({
            operation: "delete",
            modification: {
              pwdMaxFailure: undefined,
            },
          }));
        }

        if (typeof ldap.ppolicy?.pwdLockoutDurationMinutes === "number" &&
          ldap.ppolicy.pwdLockoutDurationMinutes >= 0) {

          await modify(ldap.ppolicy.defaultOlcPPolicyDn, new ldapjs.Change({
            operation: "replace",
            modification: {
              pwdLockoutDuration: ldap.ppolicy.pwdLockoutDurationMinutes * 60,
            },
          }));
        } else {
          await modify(ldap.ppolicy.defaultOlcPPolicyDn, new ldapjs.Change({
            operation: "delete",
            modification: {
              pwdLockoutDuration: undefined,
            },
          }));
        }
      } catch (err: any) {
        log.error(err.message);
      }
    }

    return true;
  });
}
