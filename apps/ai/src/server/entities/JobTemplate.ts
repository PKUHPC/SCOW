import { EntitySchema } from "@mikro-orm/core";
import { CURRENT_TIMESTAMP, DATETIME_TYPE } from "src/server/utils/orm";
import { JobType } from "src/models/Job";
import { AnyJson } from "@scow/lib-web/build/utils/type";

export class JobTemplate {
  id!: number;
  userId: string;
  jobType: JobType;
  templateName: string;
  appId: string;
  cluster: string;
  formData: AnyJson;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(init: {
    userId: string;
    jobType: JobType;
    templateName: string;
    appId?: string;
    cluster: string;
    formData: AnyJson;
  }) {
    this.userId = init.userId;
    this.jobType = init.jobType;
    this.templateName = init.templateName;
    this.appId = init.appId ?? "";
    this.cluster = init.cluster;
    this.formData = init.formData;
  }
}

export const jobTemplateEntitySchema = new EntitySchema({ class: JobTemplate });

jobTemplateEntitySchema.addPrimaryKey("id", Number);
jobTemplateEntitySchema.addProperty("userId", String);
jobTemplateEntitySchema.addEnum("jobType", String, { items: () => JobType });
jobTemplateEntitySchema.addProperty("templateName", String);
jobTemplateEntitySchema.addProperty("appId", String, { default: "" });
jobTemplateEntitySchema.addProperty("cluster", String);
jobTemplateEntitySchema.addProperty("formData", "json");
jobTemplateEntitySchema.addProperty("createdAt", Date, {
  columnType: DATETIME_TYPE,
  defaultRaw: CURRENT_TIMESTAMP,
});
jobTemplateEntitySchema.addProperty("updatedAt", Date, {
  columnType: DATETIME_TYPE,
  defaultRaw: CURRENT_TIMESTAMP,
  onUpdate: () => new Date(),
});
jobTemplateEntitySchema.addUnique({
  properties: ["userId", "templateName", "jobType", "appId"],
  name: "uk_user_template_name",
});
jobTemplateEntitySchema.addIndex({
  properties: ["userId", "jobType", "appId"],
  name: "idx_user_job_type_app",
});
