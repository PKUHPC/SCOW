import { Collection, EntitySchema } from "@mikro-orm/core";
import { CURRENT_TIMESTAMP, DATETIME_TYPE } from "src/server/utils/orm";

import { DatasetVersion } from "./DatasetVersion";

export class Dataset {
  id!: number;
  name: string;
  owner: string;
  type: string;
  versions = new Collection<DatasetVersion>(this);
  isShared: boolean;
  scene: string;
  description?: string;
  clusterId: string;
  createTime?: Date;
  updateTime?: Date;
  isPlatformOwned: boolean;

  constructor(init: {
    name: string;
    owner: string;
    type: string;
    isShared?: boolean;
    scene: string;
    description?: string;
    clusterId: string;
    createTime?: Date;
    updateTime?: Date;
    isPlatformOwned?: boolean;
  }) {
    this.name = init.name;
    this.owner = init.owner;
    this.type = init.type;
    this.isShared = init.isShared ?? false;
    this.scene = init.scene;
    this.description = init.description;
    this.clusterId = init.clusterId;
    this.isPlatformOwned = init.isPlatformOwned ?? false;

    if (init.createTime) {
      this.createTime = init.createTime;
    }

    if (init.updateTime) {
      this.updateTime = init.updateTime;
    }
  }
}

export const datasetEntitySchema = new EntitySchema({
  class: Dataset,
});

datasetEntitySchema.addPrimaryKey("id", Number);
datasetEntitySchema.addProperty("name", String);
datasetEntitySchema.addProperty("owner", String);
datasetEntitySchema.addProperty("type", String);
datasetEntitySchema.addOneToMany("versions", "DatasetVersion", {
  entity: () => "DatasetVersion",
  mappedBy: (dv) => dv.dataset,
});
datasetEntitySchema.addProperty("isShared", Boolean);
datasetEntitySchema.addProperty("scene", String);
datasetEntitySchema.addProperty("description", String, { nullable: true });
datasetEntitySchema.addProperty("clusterId", String);
datasetEntitySchema.addProperty("createTime", Date, { columnType: DATETIME_TYPE, defaultRaw: CURRENT_TIMESTAMP });
datasetEntitySchema.addProperty("updateTime", Date, {
  columnType: DATETIME_TYPE,
  defaultRaw: CURRENT_TIMESTAMP,
  onUpdate: () => new Date(),
});
datasetEntitySchema.addProperty("isPlatformOwned", Boolean, { default: false, nullable: false });
