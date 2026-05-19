import { parsePlaceholder } from "@scow/lib-config";
import { FastifyRequest } from "fastify";
import ldapjs, { EntryAlreadyExistsError } from "ldapjs";
import { CreateUserInfo, CreateUserResult } from "src/auth/AuthProvider";
import { searchOne, useLdap } from "src/auth/ldap/helpers";
import { modifyPasswordBase } from "src/auth/ldap/password";
import { LdapConfigSchema, NewUserGroupStrategy } from "src/config/auth";
import { RequiredBy } from "src/utils/validations";
import { promisify } from "util";

/*
 * Apply extra props.
 * @param obj the object to apply extra props
 * @param extraProps the extraProps config
 * @param placeholderObj the object where the values of placeholders ({{ }}) are from
 */
const applyExtraProps = (obj: object, extraProps: Record<string, string | string[] | null>, placeholderObj: object) => {
  for (const key in extraProps) {
    const value = extraProps[key];
    if (value === null) {
      delete obj[key];
    } else if (Array.isArray(value)) {
      obj[key] = value.map((x) => parsePlaceholder(x, placeholderObj));
    } else {
      obj[key] = parsePlaceholder(value, placeholderObj);
    }
  }
};

export async function createUser(
  info: CreateUserInfo,
  req: FastifyRequest,
  ldap: RequiredBy<LdapConfigSchema, "addUser">,
): Promise<CreateUserResult> {
  const id = info.id + ldap.addUser.uidStart;

  return await useLdap(
    req.log,
    ldap,
  )(async (client) => {
    const userDn = `${ldap.addUser.userIdDnKey ?? ldap.attrs.uid}=${info.identityId},` + `${ldap.addUser.userBase}`;
    const userEntry: Record<string, string | string[] | number> = {
      [ldap.attrs.uid]: info.identityId,
      sn: info.identityId,
      loginShell: "/bin/bash",
      objectClass: ["inetOrgPerson", "posixAccount", "shadowAccount"],
      homeDirectory: parsePlaceholder(ldap.addUser.homeDir, { userId: info.identityId }),
      uidNumber: id,
      gidNumber: id,
    };

    if (ldap.attrs.name) {
      userEntry[ldap.attrs.name] = info.name;
    }

    if (ldap.attrs.mail) {
      userEntry[ldap.attrs.mail] = info.mail;
    }

    // parse attributes
    if (ldap.addUser.extraProps) {
      applyExtraProps(userEntry, ldap.addUser.extraProps, userEntry);
    }

    const add = promisify(client.add.bind(client));

    if (ldap.addUser.groupStrategy === NewUserGroupStrategy.newGroupPerUser) {
      req.log.info("ldap.addUser.groupStrategy is newGroupPerUser. Creating new group for the user.");

      const config = ldap.addUser.newGroupPerUser!;

      const groupDn = `${config.groupIdDnKey ?? ldap.attrs.uid}=${info.identityId},${config.groupBase}`;
      const groupEntry = {
        objectClass: ["posixGroup"],
        memberUid: info.identityId,
        gidNumber: id,
      };

      userEntry.gidNumber = id;

      if (config.extraProps) {
        applyExtraProps(groupEntry, config.extraProps, userEntry);
      }

      req.log.info("Adding group %s with entry info %o", groupDn, groupEntry);
      try {
        await add(groupDn, groupEntry);
      } catch (e) {
        if (e instanceof EntryAlreadyExistsError) {
          return "AlreadyExists";
        } else {
          throw e;
        }
      }
    } else if (ldap.addUser.groupStrategy === NewUserGroupStrategy.oneGroupForAllUsers) {
      const config = ldap.addUser.oneGroupForAllUsers!;

      req.log.info("ldap.addUser.groupStrategy is one-group-for-all-users.");
      req.log.info("Using existing group %s for the user", config.gidNumber);

      userEntry.gidNumber = config.gidNumber;
    }

    req.log.info("Adding people %s with entry info %o", userDn, userEntry);
    try {
      await add(userDn, userEntry);
    } catch (e) {
      if (e instanceof EntryAlreadyExistsError) {
        return "AlreadyExists";
      } else {
        throw e;
      }
    }

    // set password as admin user
    await modifyPasswordBase(userDn, undefined, info.password, client);

    // Add user to ldap group
    const addUserToLdapGroup = ldap.addUser.addUserToLdapGroup;

    if (addUserToLdapGroup) {
      // get existing members
      req.log.info("Adding %s to group %s", userDn, addUserToLdapGroup);

      const members = await searchOne(
        req.log,
        client,
        addUserToLdapGroup,
        {
          attributes: ["member"],
        },
        (entry) => {
          const member = entry.attributes.find((x) => x.json.type === "member");
          if (!member) {
            return undefined;
          }

          return { members: member.json.vals };
        },
      );

      if (!members) {
        req.log.error("Didn't find LDAP group %s", addUserToLdapGroup);
        class RequestError extends Error {
          constructor(
            public code: string,
            message: string,
          ) {
            super(message);
          }
        }
        throw new RequestError("INTERNAL_ERROR", "Didn't find LDAP group " + addUserToLdapGroup);
      }
      // add the dn of the new user to the value
      const modify = promisify(client.modify.bind(client));
      await modify(
        addUserToLdapGroup,
        new ldapjs.Change({
          operation: "add",
          modification: {
            member: members.members.concat(userDn),
          },
        }),
      );
    }

    return "OK";
  });
}
