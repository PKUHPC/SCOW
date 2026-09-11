import { Entity, PrimaryKey, Property } from "@mikro-orm/core";

export enum AccountGroupInitStatus {
  INITIALIZING = "INITIALIZING",
  INITIALIZED = "INITIALIZED",
  NOT_INITIALIZED = "NOT_INITIALIZED",
}

@Entity()
export class SystemState {
  @PrimaryKey()
  key: string;

  @Property()
  value: string;

  public static KEYS = {
    INITIALIZATION_TIME: "INITIALIZATION_TIME",
    UPDATE_SLURM_BLOCK_STATUS: "UPDATE_SLURM_BLOCK_STATUS",
    ACCOUNT_GROUP_INITIALIZED: "ACCOUNT_GROUP_INITIALIZED",
    ACCOUNT_GROUP_INIT_CONFIRMED: "ACCOUNT_GROUP_INIT_CONFIRMED",
    /** 账户存储配额功能的开启状态: "disabled" | "enabling" | "enabled" */
    ACCOUNT_STORAGE_QUOTA_STATE: "ACCOUNT_STORAGE_QUOTA_STATE",
    /** 是否已确认开启账户存储配额: "true" | "false" */
    CONFIRMED_ENABLE_ACCOUNT_QUOTA: "CONFIRMED_ENABLE_ACCOUNT_QUOTA",
  } as const;

  constructor(key: keyof typeof SystemState.KEYS, value: string) {
    this.key = key;
    this.value = value;
  }
}
