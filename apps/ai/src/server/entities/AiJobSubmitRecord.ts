import { EntitySchema } from "@mikro-orm/core";
import { AnyJson } from "@scow/lib-web/build/utils/type";
import { JobType } from "src/models/Job";
import { CURRENT_TIMESTAMP, DATETIME_TYPE } from "src/server/utils/orm";

export class AiJobSubmitRecord {
  id!: number;
  userId: string;
  jobType: JobType;
  jobId: number;
  appId?: string;
  cluster: string;
  account: string;
  formData: AnyJson;
  createdAt?: Date;

  constructor(init: {
    userId: string;
    jobType: JobType;
    jobId: number;
    appId?: string;
    cluster: string;
    account: string;
    formData: AnyJson;
  }) {
    this.userId = init.userId;
    this.jobType = init.jobType;
    this.jobId = init.jobId;
    this.appId = init.appId;
    this.cluster = init.cluster;
    this.account = init.account;
    this.formData = init.formData;
  }
}

export const aiJobSubmitRecordEntitySchema = new EntitySchema({ class: AiJobSubmitRecord });

aiJobSubmitRecordEntitySchema.addPrimaryKey("id", Number);
aiJobSubmitRecordEntitySchema.addProperty("userId", String);
aiJobSubmitRecordEntitySchema.addEnum("jobType", String, { items: () => JobType });
aiJobSubmitRecordEntitySchema.addProperty("jobId", Number);
aiJobSubmitRecordEntitySchema.addProperty("appId", String, { nullable: true });
aiJobSubmitRecordEntitySchema.addProperty("cluster", String);
aiJobSubmitRecordEntitySchema.addProperty("account", String);
aiJobSubmitRecordEntitySchema.addProperty("formData", "json", { nullable: false });
aiJobSubmitRecordEntitySchema.addProperty("createdAt", Date, {
  columnType: DATETIME_TYPE,
  defaultRaw: CURRENT_TIMESTAMP,
});
aiJobSubmitRecordEntitySchema.addUnique({
  properties: ["userId", "cluster", "jobId"],
  name: "uk_user_cluster_job_id",
});
