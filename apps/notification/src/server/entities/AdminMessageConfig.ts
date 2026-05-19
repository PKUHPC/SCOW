import { EntitySchema } from "@mikro-orm/core";
import { NoticeType } from "src/models/notice-type";
import { DATETIME_TYPE } from "src/utils/orm";

export class AdminMessageConfig {
  id!: number;
  messageType: string;
  noticeType: NoticeType;
  enabled: boolean;
  canUserModify: boolean;
  // 每个通知类型的过期时间（秒）
  expiredAfterSeconds?: bigint;
  createdAt = new Date();
  updatedAt = new Date();

  constructor(init: { messageType: string; noticeType: NoticeType; enabled: boolean; canUserModify: boolean }) {
    this.messageType = init.messageType;
    this.noticeType = init.noticeType;
    this.enabled = init.enabled;
    this.canUserModify = init.canUserModify;
  }
}

export const AdminMessageConfigSchema = new EntitySchema<AdminMessageConfig>({
  class: AdminMessageConfig,
  tableName: "admin_message_configs", // 数据库表名
  properties: {
    id: { type: Number, primary: true },
    noticeType: { enum: true, items: () => NoticeType },
    messageType: { type: "string", length: 255 },
    enabled: { type: "boolean" },
    canUserModify: { type: "boolean" },
    expiredAfterSeconds: { type: "bigint", nullable: true },
    createdAt: { type: "date", columnType: DATETIME_TYPE },
    updatedAt: { type: "date", columnType: DATETIME_TYPE, onUpdate: () => new Date() },
  },
  // 设置联合唯一约束
  indexes: [{ properties: ["noticeType", "messageType"], options: { unique: true } }],
});
