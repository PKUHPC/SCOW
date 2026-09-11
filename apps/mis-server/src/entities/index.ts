import { Account } from "src/entities/Account";
import { AccountAppBlacklist } from "src/entities/AccountAppBlacklist";
import { AccountBill } from "src/entities/AccountBill";
import { AccountStorageQuota } from "src/entities/AccountStorageQuota";
import { AccountUserSyncRecord } from "src/entities/AccountUserSyncRecord";
import { AccountWhitelist } from "src/entities/AccountWhitelist";
import { ChargeRecord } from "src/entities/ChargeRecord";
import { Cluster } from "src/entities/Cluster";
import { DailyStorageUsage } from "src/entities/DailyStorageUsage";
import { JobInfo } from "src/entities/JobInfo";
import { JobPriceChange } from "src/entities/JobPriceChange";
import { JobPriceItem } from "src/entities/JobPriceItem";
import { PayRecord } from "src/entities/PayRecord";
import { QueryCache } from "src/entities/QueryCache";
import { RunningJobChargeRecord } from "src/entities/RunningJobChargeRecord";
import { StoragePriceItem } from "src/entities/StoragePriceItem";
import { SystemState } from "src/entities/SystemState";
import { Tenant } from "src/entities/Tenant";
import { TenantAppBlacklist } from "src/entities/TenantAppBlacklist";
import { TenantStorageQuota } from "src/entities/TenantStorageQuota";
import { TenantUserStorageQuota } from "src/entities/TenantUserStorageQuota";
import { User } from "src/entities/User";
import { UserAccount } from "src/entities/UserAccount";
import { UserBill } from "src/entities/UserBill";

import { AppTemplate } from "./AppTemplate";
import { JobTemplate } from "./JobTemplate";
import { TenantDefaultAppRemovedList } from "./TenantDefaultAppRemovedList";

export const entities = [
  UserAccount,
  AccountWhitelist,
  User,
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
  TenantStorageQuota,
  TenantUserStorageQuota,
  AccountAppBlacklist,
  TenantAppBlacklist,
  TenantDefaultAppRemovedList,
  RunningJobChargeRecord,
  StoragePriceItem,
  DailyStorageUsage,
  JobTemplate,
  AppTemplate,
  AccountStorageQuota,
];
