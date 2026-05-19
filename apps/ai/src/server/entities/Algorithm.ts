import { Collection, EntitySchema } from "@mikro-orm/core";
import { CURRENT_TIMESTAMP, DATETIME_TYPE } from "src/server/utils/orm";

import { AlgorithmVersion } from "./AlgorithmVersion";

export enum Framework {
  TENSORFLOW = "TENSORFLOW",
  PYTORCH = "PYTORCH",
  KERAS = "KERAS",
  MINDSPORE = "MINDSPORE",
  OTHER = "OTHER",
}

export class Algorithm {
  id!: number;

  name: string;

  owner: string;

  framework: Framework;

  versions = new Collection<AlgorithmVersion>(this);

  isShared: boolean;

  description?: string;
  clusterId: string;

  createTime?: Date;
  updateTime?: Date;
  isPlatformOwned: boolean;

  constructor(init: {
    name: string;
    owner: string;
    framework: Framework;
    isShared?: boolean;
    description?: string;
    clusterId: string;
    createTime?: Date;
    updateTime?: Date;
    isPlatformOwned?: boolean;
  }) {
    this.name = init.name;
    this.owner = init.owner;
    this.framework = init.framework;
    this.isShared = init.isShared || false;
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

export const algorithmEntitySchema = new EntitySchema({
  class: Algorithm,
});

// 为方便类型校验，使用addProperty等方法添加属性，未用 https://mikro-orm.io/docs/entity-schema 示例中的 properties: {}

algorithmEntitySchema.addPrimaryKey("id", Number);
algorithmEntitySchema.addProperty("name", String);
algorithmEntitySchema.addProperty("owner", String);
algorithmEntitySchema.addEnum("framework", String, { items: () => Framework });
algorithmEntitySchema.addOneToMany("versions", "AlgorithmVersion", {
  entity: () => "AlgorithmVersion",
  mappedBy: (a) => a.algorithm,
});
algorithmEntitySchema.addProperty("isShared", Boolean);
algorithmEntitySchema.addProperty("description", String, { nullable: true });
algorithmEntitySchema.addProperty("clusterId", String);
algorithmEntitySchema.addProperty("createTime", Date, { columnType: DATETIME_TYPE, defaultRaw: CURRENT_TIMESTAMP });
algorithmEntitySchema.addProperty("updateTime", Date, {
  columnType: DATETIME_TYPE,
  defaultRaw: CURRENT_TIMESTAMP,
  onUpdate: () => new Date(),
});
algorithmEntitySchema.addProperty("isPlatformOwned", Boolean, { default: false, nullable: false });
