import { Code, ConnectError } from "@connectrpc/connect";
import { SqlEntityManager } from "@mikro-orm/mysql";
import { InternalMessageType, internalMessageTypesMap, MessageTypeInfo } from "src/models/message-type";
import { CustomMessageType } from "src/server/entities/CustomMessageType";
import { Message } from "src/server/entities/Message";

import { checkAdminMessageTypeExist } from "./rendering-message";

export const getAllMessageTypesData = async (em: SqlEntityManager): Promise<CustomMessageType[]> => {
  const internalMessageTypesData = Array.from(internalMessageTypesMap.values()).map((data) => {
    return data as CustomMessageType;
  });

  const customMessageTypesData = (await em.findAll(CustomMessageType)).map((data) => {
    return data as CustomMessageType;
  });

  return [...internalMessageTypesData, ...customMessageTypesData];
};

export const checkMessageTypeExist = async (em: SqlEntityManager, type: string): Promise<CustomMessageType | null> => {
  if (internalMessageTypesMap.has(type as InternalMessageType)) {
    return { type, ...internalMessageTypesMap.get(type as InternalMessageType) } as CustomMessageType;
  }

  const messageType = await em.findOne(CustomMessageType, { type });
  if (messageType) {
    return messageType;
  }

  return null;
};

// 查找符合条件的值的函数
export function findInInternalMessageTypesMap(type?: string, category?: string): MessageTypeInfo[] {
  const result: MessageTypeInfo[] = [];

  // 如果 type 和 category 都未提供，则返回所有内置类型
  if (!type && !category) {
    for (const [_, value] of internalMessageTypesMap.entries()) {
      result.push({
        ...value,
      });
    }
  }

  // 如果提供了 type 参数
  if (type && internalMessageTypesMap.has(type as InternalMessageType)) {
    const messageTypeInfo = internalMessageTypesMap.get(type as InternalMessageType);
    if (!category || messageTypeInfo?.category === category) {
      result.push({
        ...(messageTypeInfo as Omit<MessageTypeInfo, "type">),
        type,
      });
    }
  }

  // 如果未提供 type 参数，只检查 category 参数
  if (!type && category) {
    for (const [_, value] of internalMessageTypesMap.entries()) {
      if (value.category === category) {
        result.push({
          ...value,
        });
      }
    }
  }

  return result;
}

export async function getMessagesTypeData(em: SqlEntityManager, messages: Message[]) {
  // 使用 Map 来缓存已查询的 messageTypeData
  const messageTypeDataMap = new Map<string, MessageTypeInfo>();

  // 并行获取所有 messageTypeData，并缓存到 messageTypeDataMap 中
  const messageTypeDataPromises = messages.map(async (message) => {
    const messageType = message.messageType;
    if (!messageTypeDataMap.has(messageType)) {
      const messageTypeData = (await checkMessageTypeExist(em, messageType)) ?? checkAdminMessageTypeExist(messageType);
      if (!messageTypeData) {
        // throw new ConnectError(
        //   `message ${message.id} has unknown message type ${message.messageType}`,
        //   Code.Internal,
        // );
        return;
      }
      messageTypeDataMap.set(messageType, messageTypeData);
    }
  });

  await Promise.all(messageTypeDataPromises);

  return messageTypeDataMap;
}

export async function getMessageTypeData(em: SqlEntityManager, messageType: string) {
  const messageTypeData = await checkMessageTypeExist(em, messageType);
  if (!messageTypeData) {
    throw new ConnectError(`Unknown message type ${messageType}`, Code.Internal);
  }

  return messageTypeData;
}
