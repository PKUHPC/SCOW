import { Entity, Enum, Index, PrimaryKey, Property } from "@mikro-orm/core";
import { ListAccountUserSynchronizationsResponse_ClusterTotalSyncResult } from "@scow/protos/build/server/admin";
import { CURRENT_TIMESTAMP, DATETIME_TYPE } from "src/utils/orm";

// 同步状态： 全部完成，正在运行及未执行
export enum SyncStatus {
  COMPLETED = "COMPLETED",
  RUNNING = "RUNNING",
  UNEXECUTED = "UNEXECUTED",
}

// 同步结果： 成功，失败
export enum SyncResult {
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
}

@Entity()
export class AccountUserSyncRecord {
  @PrimaryKey()
  id!: number;

  // 一次完整的同步任务的会话ID
  @Property(({ length: 50 }))
  sessionId!: string;

  @Property({ nullable: true })
  syncOperatorId?: string;

  @Index({ name: "start_time" })
  @Property({ columnType: DATETIME_TYPE, defaultRaw: CURRENT_TIMESTAMP })
  startTime!: Date;

  @Property({ columnType: DATETIME_TYPE, nullable: true, onUpdate: () => new Date() })
  updateTime: Date | undefined;

  @Enum({ items: () => SyncStatus, default: SyncStatus.RUNNING, comment: Object.values(SyncStatus).join(", ") })
  syncStatus: SyncStatus;

  @Enum({ items: () => SyncResult, nullable: true, comment: Object.values(SyncResult).join(", ") })
  syncResult: SyncResult | undefined;

  @Property({ type: "json", nullable: true })
  syncDetails?: ListAccountUserSynchronizationsResponse_ClusterTotalSyncResult[];

  @Property({ columnType: "int" })
  maxSyncDurationMinutes: number;

  constructor(init: {
    sessionId: string,
    syncOperatorId?: string,
    updateTime?: Date,
    syncStatus: SyncStatus,
    syncResult?: SyncResult,
    syncDetails?: ListAccountUserSynchronizationsResponse_ClusterTotalSyncResult[],
    maxSyncDurationMinutes: number,
  }) {
    this.sessionId = init.sessionId;
    if (init.syncOperatorId) {
      this.syncOperatorId = init.syncOperatorId;
    }
    this.syncStatus = init.syncStatus;
    if (init.syncResult) {
      this.syncResult = init.syncResult;
    }
    if (init.updateTime) {
      this.updateTime = init.updateTime;
    }
    if (init.syncDetails) {
      this.syncDetails = init.syncDetails;
    }

    this.maxSyncDurationMinutes = init.maxSyncDurationMinutes;
  }

}
