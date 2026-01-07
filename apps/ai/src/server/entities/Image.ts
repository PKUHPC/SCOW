import { EntitySchema } from "@mikro-orm/core";
import { ImageType } from "src/models/Image";
import { CURRENT_TIMESTAMP, DATETIME_TYPE } from "src/server/utils/orm";

export enum Source {
  INTERNAL = "INTERNAL",
  EXTERNAL = "EXTERNAL",
};

export enum Status {
  CREATED = "CREATED",
  CREATING = "CREATING",
  FAILURE = "FAILURE",
}

export class Image {
  id!: number;
  name: string;
  owner: string;
  source: Source;
  tag: string;
  // 用户删除镜像(name,tag)后再次新建相同的镜像(name,tag)，会导致计算节点不会拉取新镜像(使用之前同名同tag的镜像)
  // 故增加这个tagPostfix使得tag唯一，解决缓存问题
  tagPostfix?: string;
  description?: string;
  clusterId?: string;

  // 这里是上传镜像时的源文件path
  sourcePath?: string;

  // 这里是提交作业时可以使用的真实镜像path，每次上传镜像一定对应一个真实的镜像path
  path?: string;

  isShared: boolean;
  status: Status;
  createTime?: Date;
  updateTime?: Date;
  // 镜像分类，类型的取值为：应用、训练、推理，支持多选
  types: ImageType[];
  inferServicePort?: string;
  startCommand?: string;
  failedReason?: string;

  constructor(init: {
    name: string;
    owner: string;
    source: Source;
    tag: string;
    tagPostfix: string;
    description?: string;
    path?: string;
    sourcePath?: string;
    isShared?: boolean;
    status: Status;
    clusterId?: string;
    createTime?: Date;
    updateTime?: Date;
    types: ImageType[];
    inferServicePort?: string;
    startCommand?: string;
    failedReason?: string;
  }) {
    this.name = init.name;
    this.owner = init.owner;
    this.source = init.source;
    this.tag = init.tag;
    this.tagPostfix = init.tagPostfix;
    this.description = init.description;
    this.path = init.path;
    this.sourcePath = init.sourcePath;
    this.isShared = init.isShared ?? false;
    this.status = init.status;
    this.clusterId = init.clusterId;
    this.types = init.types;
    this.inferServicePort = init.inferServicePort;
    this.startCommand = init.startCommand;
    this.failedReason = init.failedReason;

    if (init.createTime) {
      this.createTime = init.createTime;
    }

    if (init.updateTime) {
      this.updateTime = init.updateTime;
    }
  }
}

export const imageEntitySchema = new EntitySchema({
  class: Image,
});

imageEntitySchema.addPrimaryKey("id", Number);
imageEntitySchema.addProperty("name", String);
imageEntitySchema.addProperty("owner", String);
imageEntitySchema.addEnum("source", String, { items: () => Source });
imageEntitySchema.addProperty("tag", String);
imageEntitySchema.addProperty("tagPostfix", String, { nullable: true });
imageEntitySchema.addUnique({
  properties: ["name", "tag", "owner"],
  name: "unique_name_tag_owner",
});
imageEntitySchema.addProperty("description", String, { nullable: true });
imageEntitySchema.addProperty("clusterId", String, { nullable: true });
imageEntitySchema.addProperty("sourcePath", String);
imageEntitySchema.addProperty("path", String, { nullable: true });
imageEntitySchema.addProperty("isShared", Boolean);
imageEntitySchema.addEnum("status", String, { items: () => Status });
imageEntitySchema.addEnum("types", String, {
  columnType: "varchar(255)",
  items: () => ImageType,
  array: true,
  default:[ImageType.APP, ImageType.TRAIN, ImageType.INFER, ImageType.DEV_HOST],
});
imageEntitySchema.addProperty("inferServicePort", String, { nullable: true });
imageEntitySchema.addProperty("startCommand", String, { columnType: "TEXT",nullable: true });
imageEntitySchema.addProperty("failedReason", String, { columnType: "TEXT",nullable: true });
imageEntitySchema.addProperty("createTime", Date, { columnType: DATETIME_TYPE, defaultRaw: CURRENT_TIMESTAMP });
imageEntitySchema.addProperty("updateTime", Date, {
  columnType: DATETIME_TYPE, defaultRaw: CURRENT_TIMESTAMP, onUpdate: () => new Date() });
