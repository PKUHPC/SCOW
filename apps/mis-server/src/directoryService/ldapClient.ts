import { LdapDirectoryServiceSchema } from "@scow/config/build/mis";
import { Logger } from "pino";
import ldapjs from "ldapjs";
import { promisify } from "util";

type LdapConnectionConfig = Pick<LdapDirectoryServiceSchema, "url" | "bindDN" | "bindPassword">;

export const useLdap = (
  logger: Logger,
  config: LdapConnectionConfig,
  user: { dn: string; password: string } = { dn: config.bindDN, password: config.bindPassword },
) => {
  return async <T>(consume: (client: ldapjs.Client) => Promise<T>): Promise<T> => {
    const client = ldapjs.createClient({ url: config.url });

    client.on("error", (err) => {
      logger.error({ err }, "LDAP Error occurred.");
    });

    const unbind = async () => {
      await promisify(client.unbind.bind(client))();
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
  logger: Logger,
  client: ldapjs.Client,
  searchBase: string,
  searchOptions: ldapjs.SearchOptions,
  extract: (entry: ldapjs.SearchEntry) => T | undefined,
): Promise<(T & { dn: string }) | undefined> => {
  return new Promise((resolve, reject) => {
    client.search(searchBase, searchOptions, (err, res) => {
      if (err) { reject(err as Error); return; }

      let found = false;

      res.on("searchEntry", (entry) => {
        if (found) return;
        const val = extract(entry);
        if (!val) return;
        found = true;
        resolve({ ...val, dn: entry.dn });
      });

      res.on("error", (err) => {
        logger.error({ err }, "LDAP search error");
        reject(err as Error);
      });

      res.on("end", (result) => {
        if (result?.status === 0) {
          resolve(undefined);
        } else {
          reject(new Error(result?.errorMessage));
        }
      });
    });
  });
};

export const searchAll = async <T>(
  logger: Logger,
  client: ldapjs.Client,
  searchBase: string,
  searchOptions: ldapjs.SearchOptions,
  extract: (entry: ldapjs.SearchEntry) => T | undefined,
): Promise<(T & { dn: string })[]> => {
  return new Promise((resolve, reject) => {
    client.search(searchBase, searchOptions, (err, res) => {
      if (err) { reject(err as Error); return; }

      const results: (T & { dn: string })[] = [];

      res.on("searchEntry", (entry) => {
        const val = extract(entry);
        if (!val) return;
        results.push({ ...val, dn: entry.dn });
      });

      res.on("error", (err) => {
        logger.error({ err }, "LDAP search error");
        reject(err as Error);
      });

      res.on("end", (result) => {
        if (result?.status === 0) {
          resolve(results);
        } else {
          reject(new Error(result?.errorMessage));
        }
      });
    });
  });
};

export const extractAttr = (entry: ldapjs.SearchEntry, attr: string): string[] | undefined =>
  entry.attributes.find((x) => x.json.type === attr)?.vals as string[] | undefined;

export const takeOne = (val: string | string[] | undefined): string | undefined => {
  if (typeof val === "string") return val;
  return val?.[0];
};
