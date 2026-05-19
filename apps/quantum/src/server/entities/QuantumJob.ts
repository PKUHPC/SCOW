import { EntitySchema, JsonType } from "@mikro-orm/core";
import { Decimal } from "@scow/lib-decimal";
import { DetailTask, type TaskStates } from "src/models/task";
import { DecimalType } from "src/server/utils/decimal";

export class QuantumJob {
  id!: number;

  // API返回的作业ID
  jobId: string;

  submitTime: Date;

  state: keyof typeof TaskStates;

  info: DetailTask;

  userId: string;

  accountName: string;

  tenantName: string;

  lastSyncTime: Date;

  qits?: Decimal;

  amount?: Decimal;

  constructor(init: {
    jobId: string;
    submitTime: Date;
    state: keyof typeof TaskStates;
    userId: string;
    accountName: string;
    tenantName: string;
    info: DetailTask;
    lastSyncTime: Date;
    qits?: Decimal;
    amount?: Decimal;
  }) {
    this.jobId = init.jobId;
    this.submitTime = init.submitTime;
    this.info = init.info;
    this.userId = init.userId;
    this.tenantName = init.tenantName;
    this.accountName = init.accountName;
    this.state = init.state;
    this.lastSyncTime = init.lastSyncTime;
    this.qits = init.qits;
    this.amount = init.amount;
  }
}

export const quantumJobSchema = new EntitySchema<QuantumJob>({
  class: QuantumJob,
  properties: {
    id: { type: "number", primary: true, autoincrement: true },
    jobId: { type: "string", nullable: false, index: true },
    submitTime: { type: "datetime", onCreate: () => new Date() },
    state: { type: "string", index: true },
    info: { type: JsonType, nullable: false },
    userId: { type: "string", nullable: false, index: true },
    tenantName: { type: "string", nullable: false, index: true },
    accountName: { type: "string", nullable: false, index: true },
    lastSyncTime: { type: "datetime", index: true },
    qits: { type: DecimalType, index: true, nullable: true },
    amount: { type: DecimalType, index: true, nullable: true },
  },
});
