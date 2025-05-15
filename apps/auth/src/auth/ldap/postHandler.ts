import formBody from "@fastify/formbody";
import { Static, Type } from "@sinclair/typebox";
import { FastifyInstance } from "fastify";
import { cacheInfo } from "src/auth/cacheInfo";
import { redirectToWeb } from "src/auth/callback";
import { checkPPolicyModule, extractAttr, findUser, searchOne, useLdap } from "src/auth/ldap/helpers";
import { serveLoginHtml } from "src/auth/loginHtml";
import { validateOtpCode } from "src/auth/otp/helper";
import { validateLoginParams } from "src/auth/validateLoginParams";
import { authConfig, LdapConfigSchema } from "src/config/auth";

export function registerPostHandler(f: FastifyInstance, ldapConfig: LdapConfigSchema) {

  void f.register(formBody);

  const bodySchema = Type.Object({
    username: Type.String(),
    password: Type.String(),
    callbackUrl: Type.String(),
    token: Type.String(),
    code: Type.String(),
    ...authConfig.otp?.enabled ? { otpCode: Type.String() } : undefined,
  });

  // register a login handler
  f.post<{ Body: Static<typeof bodySchema> }>("/public/auth", {
    schema: { body: bodySchema },
  }, async (req, res) => {

    const { username, password, callbackUrl, token, code, otpCode } = req.body;

    if (!await validateLoginParams(token, code, callbackUrl, req, res)) {
      return;
    }

    // TODO
    // 1. bind with the server
    // 2. find the user using username
    // 3. try binding the server with dn and password. if successful, the user is found.
    // 4. generate a token to represent the login
    // 5. set the token and user info to token
    // 6. redirect to /public/callback
    const logger = req.log.child({ plugin: "ldap" });

    await useLdap(logger, ldapConfig)(async (client) => {

      const user = await findUser(logger, ldapConfig, client, username);

      if (!user || user.loginShell === "/sbin/nologin") {
        const logMessage = !user
          ? `Didn't find user with ${ldapConfig.attrs.uid}=${username}`
          : `User with ${ldapConfig.attrs.uid}=${username} has been marked as deleted`;

        logger.info(logMessage);
        await serveLoginHtml({ err: true, errMessage: "invalidUserId" }, callbackUrl, req, res);
        return;
      }

      if (!await validateOtpCode({ userId: user.identityId, dn: user.dn },
        otpCode, callbackUrl, req, res, logger, client)) {
        return;
      }
      logger.info("Trying binding as %s with credentials", user.dn);

      await useLdap(logger, ldapConfig, { dn: user.dn, password })(async () => {
        logger.info("Binding as %s successful. User info %o", user.dn, user);
        const info = await cacheInfo(user.identityId, req);
        const pwdReset = await searchOne(logger, client, user.dn,
          {
            scope: "base",
            filter: "(objectClass=*)",
            attributes: ["pwdReset"],
          }, (entry) => {
            return extractAttr(entry, "pwdReset");
          },
        );
        if (pwdReset?.[0] === "TRUE") {
          await serveLoginHtml({ err: false }, callbackUrl, req, res,
            undefined, undefined, undefined, { username, password, changePasswordFlag: true });
        } else {
          await redirectToWeb(callbackUrl, info, res);
        }
      }).catch(async (err) => {
        if (err.name === "InvalidCredentialsError") {
          const pwdAttributes = await searchOne(logger, client, user.dn,
            {
              scope: "base",
              filter: "(objectClass=*)",
              attributes: ["pwdFailureTime", "pwdAccountLockedTime"],
            }, (entry) => {
              const pwdAccountLockedTime = entry.attributes.some((attr) => attr.type === "pwdAccountLockedTime");
              const pwdFailuretime = extractAttr(entry, "pwdFailureTime");

              return { isLocked: pwdAccountLockedTime, pwdFailuretime };
            },
          );

          const remainCount = Number(ldapConfig.ppolicy?.pwdMaxFailures || 0) -
            (pwdAttributes?.pwdFailuretime?.length || 0);

          const isPpolicyLoaded = await checkPPolicyModule(logger, ldapConfig);

          if (pwdAttributes?.isLocked) {
            if (ldapConfig.ppolicy?.pwdLockoutDurationMinutes === 0) {
              await serveLoginHtml({ err: true, errMessage: "accountLocked" },
                callbackUrl, req, res, undefined, undefined);
            } else {
              await serveLoginHtml({ err: true, errMessage: "accountLockedTime1",dynamicsErrMessage:
                "accountLockedTime2", lockedMinutes: ldapConfig.ppolicy?.pwdLockoutDurationMinutes },
              callbackUrl, req, res, undefined, undefined);
            }
          } else if (typeof ldapConfig.ppolicy?.pwdMaxFailures === "number" && isPpolicyLoaded) {
            await serveLoginHtml({ err: true, errMessage: "invalidPasswordRemain" },
              callbackUrl, req, res, undefined, undefined, remainCount > 0 ? remainCount : 1);
          } else {
            await serveLoginHtml({ err: true, errMessage: "invalidPassword" },
              callbackUrl, req, res, undefined, undefined);
          }
        }
        logger.info("Binding as %s failed. Err: %o", user.dn, err);
      });

    });
  });
}
