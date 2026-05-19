import { EntitySchema } from "@mikro-orm/core";
import { Template } from "src/models/message-type";
import { DATETIME_TYPE } from "src/utils/orm";

export class CustomMessageType {
  id!: number;
  type: string;
  titleTemplate: Template;
  contentTemplate: Template;
  category: string;
  categoryTemplate: Template;
  createdAt = new Date();
  updatedAt = new Date();

  constructor(init: {
    type: string;
    titleTemplate: Template;
    contentTemplate: Template;
    category: string;
    categoryTemplate: Template;
  }) {
    this.type = init.type;
    this.titleTemplate = init.titleTemplate;
    this.contentTemplate = init.contentTemplate;
    this.category = init.category;
    this.categoryTemplate = init.categoryTemplate;
  }
}

export const CustomMessageTypeSchema = new EntitySchema<CustomMessageType>({
  class: CustomMessageType,
  tableName: "custom_message_types",
  properties: {
    id: { type: "number", primary: true },
    type: { type: "string", length: 255, index: true, unique: true, nullable: false },
    titleTemplate: { type: "json" },
    contentTemplate: { type: "json" },
    category: {
      type: "string",
      length: 255,
      index: true,
      nullable: false,
      comment: "消息类型分类，例如账户通知、作业通知等",
    },
    categoryTemplate: { type: "json" },
    createdAt: { type: "date", columnType: DATETIME_TYPE },
    updatedAt: { type: "date", columnType: DATETIME_TYPE, onUpdate: () => new Date() },
  },
});
