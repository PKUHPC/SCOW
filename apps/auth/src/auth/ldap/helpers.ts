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

import { FastifyBaseLogger } from "fastify";
import ldapjs from "ldapjs";
import { LdapConfigSchema } from "src/config/auth";
import { promisify } from "util";

export const useLdap = (
  logger: FastifyBaseLogger,
  config: Pick<LdapConfigSchema, "bindDN" | "bindPassword" | "url">,
  user: { dn: string, password: string } = { dn: config.bindDN, password: config.bindPassword },
) => {

  return async <T>(consume: (client: ldapjs.Client) => Promise<T>): Promise<T> => {
    const client = ldapjs.createClient(({ url: config.url, log: logger }));

    client.on("error", (err) => {
      logger.error(err, "LDAP Error occurred.");
    });

    const unbind = async () => {
      await promisify(client.unbind.bind(client))();
      logger.info("Disconnected LDAP connection.");
    };

    return await (async () => {
      await promisify(client.bind.bind(client))(user.dn, user.password);
      return await consume(client);
    })().finally(() => {
      void unbind();
    });
  };
};

export const searchOne = async <T>(
  logger: FastifyBaseLogger,
  client: ldapjs.Client,
  searchBase: string,
  searchOptions: ldapjs.SearchOptions,
  furtherCheck: (entry: ldapjs.SearchEntry) => T | undefined,
) => {
  return new Promise<(T & { dn: string }) | undefined>((resolve, rej) => {

    client.search(searchBase, searchOptions, (err, res) => {

      if (err) { rej(err as Error); return; }
      logger.info("Search started");

      let found = false;

      res.on("searchEntry", (entry) => {
        if (found) {
          logger.info("An entry has already be found. Ignoring more entities.");
          return;
        }

        logger.info("Get an entry. %o", entry);

        const val = furtherCheck(entry);

        if (!val) {
          logger.info("Entity %o failed to pass further check");
          return;
        }

        found = true;
        logger.info("Get an entry with valid info. dn: %s.", entry.dn);
        resolve({ ...val, dn: entry.dn });
      });

      res.on("searchReference", (referral) => {
        logger.info("Get a referral: " + referral.uris.join());
      });

      res.on("error", (err) => {
        logger.error("Error. %o", err);
        rej(err as Error);
      });

      res.on("end", (result) => {
        logger.info("Received end event. %o", result);
        if (result?.status === 0) {
          resolve(undefined);
        } else {
          rej(new Error(result?.errorMessage));
        }
      });
    });
  });
};

export const checkPPolicyModule = async (logger: FastifyBaseLogger, ldapConfig: LdapConfigSchema) => {
  return await useLdap(logger, ldapConfig)(async (client) => {
    return new Promise<(boolean) | undefined>((resolve, reject) => {
      client.search("", {
        scope: "base",
        filter: "(objectClass=*)",
        attributes: ["supportedControl"],
      }, (err, res) => {
        if (err) { reject(err as Error); return; }

        res.on("searchEntry", (entry) => {
          const controls = entry.object.supportedControl || [];
          const ppolicyOID = "1.3.6.1.4.1.4203.1.10.1";
          const isSupported = controls.includes(ppolicyOID);
          resolve(isSupported);
        });

        res.on("error", (err) => {
          logger.error("Error. %o", err);
          reject(err as Error);
        });

        res.on("end", (result) => {
          logger.info("Received end event. %o", result);
          if (result?.status === 0) {
            resolve(undefined);
          } else {
            reject(new Error(result?.errorMessage));
          }
        });
      });
    });
  });
};

export const searchAll = async <T>(
  logger: FastifyBaseLogger,
  client: ldapjs.Client,
  searchBase: string,
  searchOptions: ldapjs.SearchOptions,
  furtherCheck: (entry: ldapjs.SearchEntry) => T | undefined,
) => {
  return new Promise<(T & { dn: string })[]>((resolve, rej) => {
    client.search(searchBase, searchOptions, (err, res) => {
      if (err) {
        rej(err as Error);
        return;
      }
      logger.info("Search started");

      const results: (T & { dn: string })[] = []; // 存储所有结果的数组

      res.on("searchEntry", (entry) => {
        logger.info("Get an entry. %o", entry);

        const val = furtherCheck(entry);
        if (!val) {
          logger.info("Entity failed to pass further check");
          return;
        }

        logger.info("Get an entry with valid info. dn: %s.", entry.dn);
        results.push({ ...val, dn: entry.dn }); // 收集结果
      });

      res.on("error", (err) => {
        logger.error("Error. %o", err);
        rej(err as Error);
      });

      res.on("end", (result) => {
        logger.info("Received end event. %o", result);
        if (result?.status === 0) {
          resolve(results); // 返回所有结果
        } else {
          rej(new Error(result?.errorMessage));
        }
      });
    });
  });
};

export const findUser = async (logger: FastifyBaseLogger,
  config: LdapConfigSchema, client: ldapjs.Client, id: string) => {
  return await searchOne(logger, client, config.searchBase,
    {
      scope: "sub",
      filter: new ldapjs.AndFilter({
        filters: [
          ldapjs.parseFilter(config.userFilter),
          new ldapjs.EqualityFilter({
            attribute: config.attrs.uid,
            value: id,
          })],
      }),
    }, (e) => extractUserInfoFromEntry(config, e, logger),
  );
};

export const findLockedUsers = async (logger: FastifyBaseLogger,
  config: LdapConfigSchema, client: ldapjs.Client, id?: string) => {
  const baseFilters = [
    ldapjs.parseFilter(config.userFilter),
    new ldapjs.PresenceFilter({
      attribute: "pwdAccountLockedTime",
    }),
  ];
  if (id) {
    baseFilters.push(new ldapjs.EqualityFilter({
      attribute: config.attrs.uid,
      value: id,
    }));
  }

  return await searchAll(logger, client, config.searchBase,
    {
      scope: "sub",
      filter: new ldapjs.AndFilter({
        filters: baseFilters,
      }),
      attributes: ["*", "+"],
    }, (e) => extractUserInfoFromEntry(config, e, logger),
  );
};

export const extractAttr = (entry: ldapjs.SearchEntry, attr: string): string[] | undefined => {
  return entry.attributes.find((x) => x.json.type === attr)?.vals as string[] | undefined;
};

export const extractUserInfoFromEntry = (
  config: LdapConfigSchema, entry: ldapjs.SearchEntry, log: FastifyBaseLogger,
) => {
  const identityId = takeOne(extractAttr(entry, config.attrs.uid));

  if (!identityId) {
    log.info("Candidate user (dn %s) doesn't has property key %s (set by ldap.attrs.uid). Ignored.");
    return undefined;
  }

  const name = config.attrs.name ? takeOne(extractAttr(entry, config.attrs.name)) : undefined;
  const mail = config.attrs.mail ? takeOne(extractAttr(entry, config.attrs.mail)) : undefined;
  const loginShell = config.attrs.loginShell ? takeOne(extractAttr(entry, config.attrs.loginShell)) : undefined;
  const pwdAccountLockedTime = takeOne(extractAttr(entry, "pwdAccountLockedTime"));
  return { identityId, name, mail, loginShell, pwdAccountLockedTime };
};

export function takeOne(val: string | string[] | undefined) {
  if (typeof val === "string") {
    return val;
  }
  if (val === undefined) {
    return undefined;
  }
  return val[0];
}
