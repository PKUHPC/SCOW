import { Cascade, Collection, EntitySchema } from "@mikro-orm/core";
import { DATETIME_TYPE } from "src/utils/orm";

import { MessageTarget } from "./MessageTarget";
import { TargetType, UserMessageRead } from "./UserMessageRead";

export enum SenderType {
  SYSTEM = 0,
  PLATFORM_ADMIN,
  TENANT_ADMIN,
}

export class Message {
  id!: bigint;
  senderType: SenderType;
  senderId!: string;
  targetType: TargetType;
  messageType: string;
  category: string;
  descriptionData: string[];
  metadata: Record<string, any>;
  expiredAt?: Date;
  createdAt = new Date();
  updatedAt = new Date();
  userMessageRead = new Collection<UserMessageRead>(this);
  messageTarget = new Collection<MessageTarget>(this);

  constructor(init: {
    senderId: string;
    senderType: SenderType;
    targetType: TargetType;
    messageType: string;
    category: string;
    metadata?: Record<string, any>;
    descriptionData?: string[];
    expiredAt?: Date;
  }) {
    this.senderId = init.senderId;
    this.senderType = init.senderType;
    this.targetType = init.targetType;
    this.messageType = init.messageType;
    this.category = init.category;
    this.metadata = init.metadata ?? {};
    this.descriptionData = init.descriptionData ?? [];
    this.expiredAt = init.expiredAt;
  }
}

export const MessageSchema = new EntitySchema<Message>({
  class: Message,
  tableName: "messages",
  properties: {
    id: { type: "bigint", primary: true },
    senderType: { enum: true, items: () => SenderType, index: true, nullable: false },
    senderId: { type: String, length: 255, index: true, nullable: false },
    targetType: { enum: true, items: () => TargetType },
    metadata: { type: "json" },
    descriptionData: { type: "array" },
    messageType: { type: "string", length: 255, index: true },
    category: { type: "string", length: 255, nullable: false },
    userMessageRead: {
      kind: "1:m",
      entity: () => UserMessageRead,
      mappedBy: (userMessageRead) => userMessageRead.message,
      cascade: [Cascade.REMOVE],
    },
    messageTarget: {
      kind: "1:m",
      entity: () => MessageTarget,
      mappedBy: (messageTarget) => messageTarget.message,
      cascade: [Cascade.REMOVE],
    },
    expiredAt: { type: "data", columnType: DATETIME_TYPE, index: true, nullable: true },
    createdAt: { type: "date", columnType: DATETIME_TYPE, index: true },
    updatedAt: { type: "date", columnType: DATETIME_TYPE, onUpdate: () => new Date() },
  },
});
