/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { Collection, EntitySchema } from "@mikro-orm/core";
import { Framework } from "src/models/Algorithm";
import { CURRENT_TIMESTAMP, DATETIME_TYPE } from "src/server/utils/orm";

import { ModelVersion } from "./ModelVersion";

export class Model {
  id!: number;
  name: string;
  owner: string;
  algorithmFramework?: Framework;
  algorithmName?: string;
  versions = new Collection<ModelVersion>(this);
  isShared?: boolean;
  description?: string;
  clusterId: string;
  createTime?: Date;
  updateTime?: Date;
  isPlatformOwned: boolean;

  constructor(init: {
    name: string;
    owner: string;
    algorithmFramework?: Framework;
    algorithmName?: string;
    isShared?: boolean;
    description?: string;
    clusterId: string;
    createTime?: Date;
    updateTime?: Date;
    isPlatformOwned?: boolean;
  }) {
    this.name = init.name;
    this.owner = init.owner;
    this.algorithmFramework = init.algorithmFramework;
    this.algorithmName = init.algorithmName;
    this.isShared = init.isShared ?? false;
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

export const modelEntitySchema = new EntitySchema({
  class: Model,
});

modelEntitySchema.addPrimaryKey("id", Number);
modelEntitySchema.addProperty("name", String);
modelEntitySchema.addProperty("owner", String);

modelEntitySchema.addProperty("algorithmFramework", String, {
  comment: "algorithm algorithmFramework", nullable: true });

modelEntitySchema.addProperty("algorithmName", String, {
  comment: "algorithm name", nullable: true });

modelEntitySchema.addOneToMany("versions", "ModelVersion", {
  entity: () => "ModelVersion", mappedBy: (mv) => mv.model });

modelEntitySchema.addProperty("isShared", Boolean);
modelEntitySchema.addProperty("description", String, { nullable: true });
modelEntitySchema.addProperty("clusterId", String);

modelEntitySchema.addProperty("createTime", Date, {
  columnType: DATETIME_TYPE, defaultRaw: CURRENT_TIMESTAMP });

modelEntitySchema.addProperty("updateTime", Date, {
  columnType: DATETIME_TYPE, defaultRaw: CURRENT_TIMESTAMP, onUpdate: () => new Date() });
modelEntitySchema.addProperty("isPlatformOwned", Boolean, { default: false, nullable: false });
