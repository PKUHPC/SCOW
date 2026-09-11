import { LdapDirectoryServiceSchema } from "@scow/config/build/mis";
import ldapjs from "ldapjs";
import { Logger } from "pino";
import { IGroupService } from "src/directoryService/groupService/interface";
import { extractAttr, searchAll, searchOne, takeOne, useLdap } from "src/directoryService/ldapClient";
import { promisify } from "util";

const escapeLdapFilter = (value: string) => value
  .replace(/\\/g, "\\5c")
  .replace(/\*/g, "\\2a")
  .replace(/\(/g, "\\28")
  .replace(/\)/g, "\\29")
  .replace(/\0/g, "\\00");

// RFC 4514 —— 对 DN 中单个 RDN 属性值进行转义。
// 与过滤器转义规则不同：特殊字符直接加 \ 前缀，
// 开头的空格/# 、结尾的空格以及 NUL 字符也需要转义。
const escapeDnValue = (value: string): string => {
  let result = "";
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === "\0") {
      result += "\\00";
    } else if (
      ch === "\\" || ch === "," || ch === "+" || ch === '"' ||
      ch === "<" || ch === ">" || ch === ";" || ch === "="
    ) {
      result += `\\${ch}`;
    } else if (i === 0 && (ch === " " || ch === "#")) {
      result += `\\${ch}`;
    } else if (i === value.length - 1 && ch === " ") {
      result += `\\${ch}`;
    } else {
      result += ch;
    }
  }
  return result;
};

export class LdapGroupService implements IGroupService {
  private readonly groupBase: string;
  private readonly gidStart: number;

  constructor(
    private readonly ldap: LdapDirectoryServiceSchema,
    private readonly logger: Logger,
  ) {
    this.groupBase = ldap.groupBase;
    this.gidStart = ldap.gidStart;
  }

  private groupDn(groupName: string): string {
    return `cn=${escapeDnValue(groupName)},${this.groupBase}`;
  }

  async checkGroupExists(groupName: string): Promise<boolean> {
    return useLdap(this.logger, this.ldap)(async (client) => {
      const result = await searchOne(
        this.logger, client, this.groupBase,
        { scope: "one", filter: `(cn=${escapeLdapFilter(groupName)})`, attributes: ["cn"] },
        (entry) => ({ cn: takeOne(extractAttr(entry, "cn")) }),
      );
      return result !== undefined;
    });
  }

  async createGroup(groupName: string): Promise<void> {
    return useLdap(this.logger, this.ldap)(async (client) => {
      const add = promisify(client.add.bind(client));

      // 查询 groupBase 下所有 posixGroup 条目，收集已用的 gidNumber 集合
      // 从 gidStart 开始递增，找到第一个未被占用的数字
      // 将该数字作为新组的 gidNumber 写入 LDAP
      const allGroups = await searchAll(
        this.logger, client, this.groupBase,
        { scope: "one", filter: "(objectClass=posixGroup)", attributes: ["gidNumber"] },
        (entry) => ({ gidNumber: parseInt(takeOne(extractAttr(entry, "gidNumber")) ?? "0", 10) }),
      );

      const usedGids = new Set(allGroups.map((g) => g.gidNumber));
      let newGid = this.gidStart;
      while (usedGids.has(newGid)) newGid++;

      const dn = this.groupDn(groupName);
      const entry = {
        objectClass: ["posixGroup"],
        cn: groupName,
        gidNumber: String(newGid),
      };

      try {
        await add(dn, entry);
        this.logger.info({ groupName, gidNumber: newGid }, "Group created successfully");
      } catch (e: any) {
        if (e instanceof ldapjs.EntryAlreadyExistsError) {
          throw new Error(`Group '${groupName}' already exists`);
        }
        throw e;
      }
    });
  }

  async deleteGroup(groupName: string): Promise<void> {
    return useLdap(this.logger, this.ldap)(async (client) => {
      const del = promisify(client.del.bind(client));
      try {
        await del(this.groupDn(groupName));
        this.logger.info({ groupName }, "Group deleted successfully");
      } catch (e: any) {
        if (e?.name === "NoSuchObjectError") {
          throw new Error(`Group '${groupName}' does not exist`);
        }
        throw e;
      }
    });
  }

  async addUserToGroup(username: string, groupName: string): Promise<void> {
    return useLdap(this.logger, this.ldap)(async (client) => {
      const modify = promisify(client.modify.bind(client));
      try {
        await modify(this.groupDn(groupName), new ldapjs.Change({
          operation: "add",
          modification: { memberUid: username },
        }));
        this.logger.info({ username, groupName }, "User added to group successfully");
      } catch (e: any) {
        if (e?.name === "AttributeOrValueExistsError") return;
        throw e;
      }
    });
  }

  async removeUserFromGroup(username: string, groupName: string): Promise<void> {
    return useLdap(this.logger, this.ldap)(async (client) => {
      const modify = promisify(client.modify.bind(client));
      try {
        await modify(this.groupDn(groupName), new ldapjs.Change({
          operation: "delete",
          modification: { memberUid: username },
        }));
        this.logger.info({ username, groupName }, "User removed from group successfully");
      } catch (e: any) {
        if (e?.name === "NoSuchAttributeError") return;
        throw e;
      }
    });
  }

  async listUserGroups(username: string): Promise<{ name: string; gid: number | undefined }[]> {
    return useLdap(this.logger, this.ldap)(async (client) => {
      const groups = await searchAll(
        this.logger, client, this.groupBase,
        { scope: "one", filter: `(memberUid=${escapeLdapFilter(username)})`, attributes: ["cn", "gidNumber"] },
        (entry) => ({
          cn: takeOne(extractAttr(entry, "cn")),
          gidNumber: takeOne(extractAttr(entry, "gidNumber")),
        }),
      );
      return groups
        .filter((g): g is typeof g & { cn: string } => g.cn !== undefined)
        .map((g) => ({ name: g.cn, gid: g.gidNumber !== undefined ? Number(g.gidNumber) : undefined }));
    });
  }

  async getUserPrimaryGroup(username: string): Promise<string | undefined> {
    return useLdap(this.logger, this.ldap)(async (client) => {
      const user = await searchOne(
        this.logger, client, this.ldap.searchBase,
        {
          scope: "sub",
          filter: `(${this.ldap.attrs.uid}=${escapeLdapFilter(username)})`,
          attributes: ["gidNumber"],
        },
        (entry) => ({ gidNumber: takeOne(extractAttr(entry, "gidNumber")) }),
      );

      if (!user?.gidNumber) return undefined;

      const group = await searchOne(
        this.logger, client, this.groupBase,
        {
          scope: "one",
          filter: `(gidNumber=${escapeLdapFilter(user.gidNumber)})`,
          attributes: ["cn"],
        },
        (entry) => ({ cn: takeOne(extractAttr(entry, "cn")) }),
      );

      return group?.cn;
    });
  }

  async setUserPrimaryGroup(username: string, groupName: string): Promise<void> {
    return useLdap(this.logger, this.ldap)(async (client) => {
      const group = await searchOne(
        this.logger, client, this.groupBase,
        { scope: "one", filter: `(cn=${escapeLdapFilter(groupName)})`, attributes: ["gidNumber"] },
        (entry) => ({ gidNumber: takeOne(extractAttr(entry, "gidNumber")) }),
      );

      if (!group?.gidNumber) {
        throw new Error(`Group '${groupName}' not found or has no gidNumber`);
      }

      await this.setUserGidNumber(client, username, group.gidNumber);
      this.logger.info({ username, groupName }, "User primary group set successfully");
    });
  }

  async setUserPrimaryGroupByGidNumber(username: string, gidNumber: number): Promise<void> {
    return useLdap(this.logger, this.ldap)(async (client) => {
      await this.setUserGidNumber(client, username, String(gidNumber));
      this.logger.info({ username, gidNumber }, "User primary group set by gidNumber successfully");
    });
  }

  async getGroupGid(groupName: string): Promise<number | undefined> {
    return useLdap(this.logger, this.ldap)(async (client) => {
      const group = await searchOne(
        this.logger, client, this.groupBase,
        { scope: "one", filter: `(cn=${escapeLdapFilter(groupName)})`, attributes: ["gidNumber"] },
        (entry) => ({ gidNumber: takeOne(extractAttr(entry, "gidNumber")) }),
      );
      if (!group?.gidNumber) return undefined;
      return parseInt(group.gidNumber, 10);
    });
  }

  async getGroupNameByGid(gid: number): Promise<string | undefined> {
    return useLdap(this.logger, this.ldap)(async (client) => {
      const group = await searchOne(
        this.logger, client, this.groupBase,
        { scope: "one", filter: `(gidNumber=${gid})`, attributes: ["cn"] },
        (entry) => ({ cn: takeOne(extractAttr(entry, "cn")) }),
      );
      return group?.cn;
    });
  }

  async getUserUidNumber(username: string): Promise<number | undefined> {
    return useLdap(this.logger, this.ldap)(async (client) => {
      const user = await searchOne(
        this.logger, client, this.ldap.searchBase,
        {
          scope: "sub",
          filter: `(${this.ldap.attrs.uid}=${escapeLdapFilter(username)})`,
          attributes: ["uidNumber"],
        },
        (entry) => ({ uidNumber: takeOne(extractAttr(entry, "uidNumber")) }),
      );
      if (!user?.uidNumber) return undefined;
      return parseInt(user.uidNumber, 10);
    });
  }

  // attributes: ["1.1"] 为标准 LDAP OID，表示不返回任何属性，仅获取 DN
  private async setUserGidNumber(client: ldapjs.Client, username: string, gidNumber: string): Promise<void> {
    const user = await searchOne(
      this.logger, client, this.ldap.searchBase,
      {
        scope: "sub",
        filter: `(${this.ldap.attrs.uid}=${escapeLdapFilter(username)})`,
        attributes: ["1.1"],
      },
      () => ({}),
    );

    if (!user) {
      throw new Error(`User '${username}' not found`);
    }

    const modify = promisify(client.modify.bind(client));
    await modify(user.dn, new ldapjs.Change({
      operation: "replace",
      modification: { gidNumber },
    }));
  }
}
