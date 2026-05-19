import { EntitySchema, type Ref } from "@mikro-orm/core";
import { CURRENT_TIMESTAMP, DATETIME_TYPE, toRef } from "src/server/utils/orm";

import { Algorithm } from "./Algorithm";
export enum SharedStatus {
  UNSHARED = "UNSHARED",
  SHARED = "SHARED",
  SHARING = "SHARING",
  UNSHARING = "UNSHARING",
}

export class AlgorithmVersion {
  id!: number;
  versionName: string;
  versionDescription?: string;
  privatePath: string;

  // 这里是提交作业时可以使用的path，当没有被分享时，path=privatePath
  path: string;

  createTime?: Date;
  updateTime?: Date;
  sharedStatus: SharedStatus;
  algorithm!: Ref<Algorithm>;

  constructor(init: {
    versionName: string;
    versionDescription?: string;
    privatePath: string;
    path: string;
    sharedStatus?: SharedStatus;
    algorithm: Algorithm;
    createTime?: Date;
    updateTime?: Date;
  }) {
    this.versionName = init.versionName;
    this.versionDescription = init.versionDescription;
    this.privatePath = init.privatePath;
    this.path = init.path;
    this.sharedStatus = init.sharedStatus ?? SharedStatus.UNSHARED;
    this.algorithm = toRef(init.algorithm);

    if (init.createTime) {
      this.createTime = init.createTime;
    }

    if (init.updateTime) {
      this.updateTime = init.updateTime;
    }
  }
}

export const algorithmVersionEntitySchema = new EntitySchema({
  class: AlgorithmVersion,
});

algorithmVersionEntitySchema.addPrimaryKey("id", Number);
algorithmVersionEntitySchema.addProperty("versionName", String);
algorithmVersionEntitySchema.addProperty("versionDescription", String, { nullable: true });
algorithmVersionEntitySchema.addProperty("privatePath", String);
algorithmVersionEntitySchema.addProperty("path", String);
algorithmVersionEntitySchema.addProperty("createTime", Date, {
  columnType: DATETIME_TYPE,
  defaultRaw: CURRENT_TIMESTAMP,
});
algorithmVersionEntitySchema.addProperty("updateTime", Date, {
  columnType: DATETIME_TYPE,
  defaultRaw: CURRENT_TIMESTAMP,
  onUpdate: () => new Date(),
});
algorithmVersionEntitySchema.addProperty("sharedStatus", String);
algorithmVersionEntitySchema.addManyToOne("algorithm", "Algorithm", {
  entity: () => Algorithm,
  deleteRule: "cascade",
  ref: true,
});
