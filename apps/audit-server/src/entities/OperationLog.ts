import { Entity, Enum, Index, PrimaryKey, Property } from "@mikro-orm/core";
import { OperationEvent } from "@scow/lib-operation-log";
import { CURRENT_TIMESTAMP, DATETIME_TYPE } from "src/utils/orm";

export enum OperationResult {
  UNKNOWN = "UNKNOWN",
  SUCCESS = "SUCCESS",
  FAIL = "FAIL",
}

@Entity()
export class OperationLog {
  @PrimaryKey()
  id!: number;

  @Property()
  operatorUserId!: string;

  @Property()
  operatorIp!: string;

  @Property({ columnType: DATETIME_TYPE, defaultRaw: CURRENT_TIMESTAMP })
  operationTime?: Date;

  @Enum({ items: () => OperationResult, comment: Object.values(OperationResult).join(", ") })
  operationResult: OperationResult;

  @Property({ type: "json", nullable: true })
  metaData?: OperationEvent & { targetAccountName?: string };

  // 用户自定义操作类型
  @Index({ name: "custom_event" })
  @Property({ nullable: true })
  customEventType?: string;

  constructor(init: {
    operationLogId?: number;
    operatorUserId: string;
    operatorIp: string;
    operationTime?: Date;
    operationResult: OperationResult;
    metaData: OperationEvent & { targetAccountName?: string };
    customEventType?: string;
  }) {
    if (init.operationLogId) {
      this.id = init.operationLogId;
    }
    this.operatorUserId = init.operatorUserId;
    this.operatorIp = init.operatorIp;
    if (init.operationTime) {
      this.operationTime = init.operationTime;
    }
    this.operationResult = init.operationResult;
    this.metaData = init.metaData;
    if (init.customEventType) {
      this.customEventType = init.customEventType;
    }
  }
}
