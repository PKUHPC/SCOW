import { Account } from "src/entities/Account";
import { AccountAppBlacklist } from "src/entities/AccountAppBlacklist";
import { AccountBill } from "src/entities/AccountBill";
import { AccountUserSyncRecord } from "src/entities/AccountUserSyncRecord";
import { AccountWhitelist } from "src/entities/AccountWhitelist";
import { ChargeRecord } from "src/entities/ChargeRecord";
import { Cluster } from "src/entities/Cluster";
import { JobInfo } from "src/entities/JobInfo";
import { JobPriceChange } from "src/entities/JobPriceChange";
import { JobPriceItem } from "src/entities/JobPriceItem";
import { PayRecord } from "src/entities/PayRecord";
import { QueryCache } from "src/entities/QueryCache";
import { StorageQuota } from "src/entities/StorageQuota";
import { SystemState } from "src/entities/SystemState";
import { Tenant } from "src/entities/Tenant";
import { TenantAppBlacklist } from "src/entities/TenantAppBlacklist";
import { User } from "src/entities/User";
import { UserAccount } from "src/entities/UserAccount";
import { UserBill } from "src/entities/UserBill";

export const entities = [
  UserAccount,
  AccountWhitelist,
  User,
  StorageQuota,
  Account,
  Tenant,
  JobInfo,
  JobPriceChange,
  JobPriceItem,
  PayRecord,
  ChargeRecord,
  SystemState,
  QueryCache,
  Cluster,
  AccountUserSyncRecord,
  UserBill,
  AccountBill,
  AccountAppBlacklist,
  TenantAppBlacklist,
];
