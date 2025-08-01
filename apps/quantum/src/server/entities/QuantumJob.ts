import { EntitySchema, JsonType } from "@mikro-orm/core";
import { DetailTask, type TaskStates } from "src/models/task";

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

  constructor(init: {
    jobId: string;
    submitTime: Date;
    state: keyof typeof TaskStates;
    userId: string;
    accountName: string;
    tenantName: string;
    info: DetailTask;
    lastSyncTime: Date;
  }) {
    this.jobId = init.jobId;
    this.submitTime = init.submitTime;
    this.info = init.info;
    this.userId = init.userId;
    this.tenantName = init.tenantName;
    this.accountName = init.accountName;
    this.state = init.state;
    this.lastSyncTime = init.lastSyncTime;
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
  },
});

