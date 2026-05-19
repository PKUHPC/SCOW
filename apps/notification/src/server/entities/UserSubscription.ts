import { EntitySchema } from "@mikro-orm/core";
import { NoticeType } from "src/models/notice-type";
import { DATETIME_TYPE } from "src/utils/orm";

export class UserSubscription {
  id!: number;
  userId: string;
  messageType: string;
  noticeType: NoticeType;
  isSubscribed: boolean;
  createdAt = new Date();
  updatedAt = new Date();

  constructor(init: { userId: string; messageType: string; noticeType: NoticeType; isSubscribed: boolean }) {
    this.userId = init.userId;
    this.messageType = init.messageType;
    this.noticeType = init.noticeType;
    this.isSubscribed = init.isSubscribed;
  }
}

export const UserSubscriptionSchema = new EntitySchema<UserSubscription>({
  class: UserSubscription,
  tableName: "user_subscriptions", // 数据库表名
  properties: {
    id: { type: "number", primary: true },
    userId: { type: "string", length: 255 },
    noticeType: { enum: true, items: () => NoticeType },
    messageType: { type: "string", length: 255 },
    isSubscribed: { type: "boolean" },
    createdAt: { type: "date", columnType: DATETIME_TYPE },
    updatedAt: { type: "date", columnType: DATETIME_TYPE, onUpdate: () => new Date() },
  },
  // 设置联合唯一约束
  indexes: [{ properties: ["noticeType", "messageType"], options: { unique: true } }],
});
