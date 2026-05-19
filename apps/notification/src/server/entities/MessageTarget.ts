import { EntitySchema, Ref } from "@mikro-orm/core";
import { NoticeType } from "src/models/notice-type";
import { DATETIME_TYPE, toRef } from "src/utils/orm";

import { Message } from "./Message";
import { TargetType } from "./UserMessageRead";

export class MessageTarget {
  id!: bigint;
  targetType: TargetType;
  targetId?: string;
  noticeTypes: NoticeType[];
  message!: Ref<Message>;
  createdAt = new Date();
  updatedAt = new Date();

  constructor(init: { targetType: TargetType; targetId?: string; noticeTypes: NoticeType[]; message: Message }) {
    this.targetType = init.targetType;
    this.targetId = init.targetId;
    this.noticeTypes = init.noticeTypes;
    this.message = toRef(init.message);
  }
}

export const MessageTargetSchema = new EntitySchema<MessageTarget>({
  class: MessageTarget,
  tableName: "message_targets",
  properties: {
    id: { type: "bigint", primary: true },
    noticeTypes: { type: "array" },
    targetType: { enum: true, items: () => TargetType, index: true },
    targetId: { type: String, length: 255, index: true, nullable: true },
    message: { kind: "m:1", entity: () => Message, deleteRule: "cascade" },
    createdAt: { type: "date", columnType: DATETIME_TYPE },
    updatedAt: { type: "date", columnType: DATETIME_TYPE, onUpdate: () => new Date() },
  },
  indexes: [
    {
      name: "target_type_target_id_idx",
      properties: ["targetType", "targetId"],
    },
  ],
});
