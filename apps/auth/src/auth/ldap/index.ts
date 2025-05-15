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

import { FastifyInstance } from "fastify";
import { AuthProvider } from "src/auth/AuthProvider";
import { createUser } from "src/auth/ldap/createUser";
import { modifyNoLogin } from "src/auth/ldap/delete";
import { modifyEmailAsSelf } from "src/auth/ldap/email";
import { findLockedUsers, findUser, useLdap } from "src/auth/ldap/helpers";
import { checkPPolicyModule } from "src/auth/ldap/helpers";
import { checkPassword, modifyForceFlag, modifyPassword } from "src/auth/ldap/password";
import { registerPostHandler } from "src/auth/ldap/postHandler";
import { modifyUnlock } from "src/auth/ldap/unlock";
import { modifyPPolicy } from "src/auth/ldap/updatePPolicy";
import { serveLoginHtml } from "src/auth/loginHtml";
import { registerOtpBindPostHandler } from "src/auth/otp";
import { authConfig, LdapConfigSchema } from "src/config/auth";
import { ensureNotUndefined, RequiredBy } from "src/utils/validations";

export const createLdapAuthProvider = async (f: FastifyInstance) => {

  const { ldap } = ensureNotUndefined(authConfig, ["ldap"]);

  registerPostHandler(f, ldap);

  registerOtpBindPostHandler(f, ldap);

  const isPpolicyLoaded = await checkPPolicyModule(f.log, ldap);

  return {
    serveLoginHtml: (callbackUrl, req, rep) => serveLoginHtml({ err: false }, callbackUrl, req, rep),
    fetchAuthTokenInfo: async () => undefined,
    getUser: async (identityId, req) => useLdap(req.log, ldap)(async (client) => (
      findUser(req.log, ldap, client, identityId)
    )),
    createUser: ldap.addUser ? async (info, req) => {
      return createUser(info, req, ldap as RequiredBy<LdapConfigSchema, "addUser">);
    } : undefined,
    checkPassword: async (id, password, req) => {
      return useLdap(req.log, ldap)(async (client) => {
        const user = await findUser(req.log, ldap, client, id);
        if (!user) {
          return "NotFound";
        }
        const result = await checkPassword(req.log, ldap, user.dn, password);
        return result ? "Match" : "NotMatch";
      });
    },
    changePassword: async (id, newPassword, req) => {
      return useLdap(req.log, ldap)(async (client) => {
        const user = await findUser(req.log, ldap, client, id);
        if (!user) {
          return "NotFound";
        }
        await modifyPassword(req.log, ldap, user.dn, newPassword);
        return "OK";
      });
    },
    changeEmail: async (id, newEmail, req) => {
      return useLdap(req.log, ldap)(async (client) => {
        const user = await findUser(req.log, ldap, client, id);
        if (!user) {
          return "NotFound";
        }

        const result = await modifyEmailAsSelf(req.log, ldap, user.dn, newEmail);

        return result ? "OK" : "Wrong";
      });
    },
    deleteUser: (ldap.deleteUser?.enabled) ? async (identityId, req) => {
      return useLdap(req.log, ldap)(async (client) => {
        const user = await findUser(req.log, ldap, client, identityId);
        if (!user) {
          return "NotFound";
        }

        const result = await modifyNoLogin(req.log, ldap, user.dn);

        return result ? "OK" : "Failed";
      });
    } : undefined,

    getLockedUsers: isPpolicyLoaded ? async (identityId, req) => useLdap(req.log, ldap)(async (client) => (
      findLockedUsers(req.log, ldap, client, identityId)
    )) : undefined,

    unlockUser: isPpolicyLoaded ? async (id, req) => {
      return useLdap(req.log, ldap)(async (client) => {
        const user = await findUser(req.log, ldap, client, id);
        if (!user) {
          return "NotFound";
        }

        const result = await modifyUnlock(req.log, ldap, user.dn);

        return result ? "OK" : "Failed";
      });
    } : undefined,
    updatePasswordResetFlag: async (id, forceFlag, req) => {
      return useLdap(req.log, ldap)(async (client) => {
        const user = await findUser(req.log, ldap, client, id);
        if (!user) {
          return "NotFound";
        }

        const result = await modifyForceFlag(req.log, ldap, user.dn, forceFlag);

        return result ? "OK" : "Failed";
      });
    },

    updatePPolicy: async (req) => useLdap(req.log, ldap)(async () => (
      modifyPPolicy(req.log, ldap)
    )),
  } as AuthProvider;

};
