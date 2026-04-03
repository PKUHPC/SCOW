import { SqlEntityManager } from "@mikro-orm/mysql";
import { getNotificationNodeClient } from "@scow/lib-notification/build/index";
import { replaceTemplate } from "@scow/lib-web/build/utils/renderingMessage";
import { NoticeType,SenderType, TargetType } from "@scow/notification-protos/build/common_pb";
import { BridgeMessage } from "@scow/notification-protos/build/message_bridge_pb";
import { notificationConfig } from "src/server/config/notification";

import { fetchAllUsers } from "./auth/get-user";
import { logger } from "./logger";
import { getMessageTypeData } from "./message-type";
import { getUserNotificationPreferences } from "./notice-type";

const BATCH_SIZE = 100;

interface AdminSendMsgToBridge {
  senderType: SenderType;
  senderId: string;
  targetType: TargetType;
  targetIds: string[];
  title: string;
  content: string;
  messageType: string;
  category: string
  noticeTypes: NoticeType[]
}

export interface SystemSendMsgToBridge {
  senderType: SenderType;
  senderId: string;
  targetType: TargetType;
  targetIds: string[];
  messageType: string;
  category: string;
  metadata: Record<string, any>;
}

export async function adminSendMsgToBridge(info: AdminSendMsgToBridge) {
  if (!notificationConfig.messageBridge) {
    return;
  }
  const client = getNotificationNodeClient(notificationConfig.messageBridge.address);

  const { title, content, messageType, category, senderType, senderId, targetType, targetIds, noticeTypes } = info;

  if (targetType === TargetType.USER) {
    const usersInfo = await fetchAllUsers(targetIds, logger);

    usersInfo.forEach(async (info) => {
      if (info === undefined) {
        return;
      }

      await client.messageBridge.sendMessage({
        messageInfo: { title, content },
        messageTypeInfo: { type: messageType, category },
        senderInfo: { senderType, senderId },
        targetInfo: { targetType, userInfo: {
          userId: info?.identityId, name: info?.name, email: info?.email,
        } },
        noticeTypes,
      });

    });
  } else {
    await client.messageBridge.sendMessage({
      messageInfo: { title, content },
      messageTypeInfo: { type: messageType, category },
      senderInfo: { senderType, senderId },
      targetInfo: { targetType },
      noticeTypes,
    });
  }

}

export async function systemSendMsgToBridge(em: SqlEntityManager, info: SystemSendMsgToBridge) {
  if (!notificationConfig.messageBridge) {
    return;
  }
  const client = getNotificationNodeClient(notificationConfig.messageBridge.address);

  const { messageType, category, senderType, senderId, targetType, targetIds, metadata } = info;

  const usersInfo = await fetchAllUsers(targetIds, logger);

  usersInfo.forEach(async (info) => {
    if (info === undefined) {
      return;
    }

    // 查询 messageType 的模板信息
    const messageTypeData = await getMessageTypeData(em, messageType);
    // 获取当前用户接收的 notice type
    const noticeTypes = await getUserNotificationPreferences(em, info.identityId, messageType);

    await client.messageBridge.sendMessage({
      messageInfo: {
        title: messageTypeData.titleTemplate.default ?? "",
        content: messageTypeData.contentTemplate
          ? replaceTemplate(metadata, messageTypeData.contentTemplate.default) : "",
        metadata,
      },
      messageTypeInfo: { type: messageType, category },
      senderInfo: { senderType, senderId },
      targetInfo: { targetType, userInfo: {
        userId: info?.identityId, name: info?.name, email: info?.email,
      } },
      noticeTypes,
    });
  });
}

export async function systemBatchSendMsgsToBridge(em: SqlEntityManager, infos: SystemSendMsgToBridge[]) {
  if (!notificationConfig.messageBridge) {
    return;
  }
  const client = getNotificationNodeClient(notificationConfig.messageBridge.address);

  const messages: BridgeMessage[] = [];
  for (const info of infos) {
    const { messageType, category, senderType, senderId, targetType, targetIds, metadata } = info;

    const usersInfo = await fetchAllUsers(targetIds, logger);

    for (const info of usersInfo) {
      if (info === undefined) {
        continue;
      }

      // 查询 messageType 的模板信息
      const messageTypeData = await getMessageTypeData(em, messageType);
      // 获取当前用户接收的 notice type
      const noticeTypes = await getUserNotificationPreferences(em, info.identityId, messageType);

      messages.push({
        messageInfo: {
          title: messageTypeData.titleTemplate.default ?? "",
          content: messageTypeData.contentTemplate
            ? replaceTemplate(metadata, messageTypeData.contentTemplate.default) : "",
          metadata,
        },
        messageTypeInfo: { type: messageType, category },
        senderInfo: { senderType, senderId },
        targetInfo: { targetType, userInfo: {
          userId: info?.identityId, name: info?.name, email: info?.email,
        } },
        noticeTypes,
      } as BridgeMessage);
    }
  }

  // 按批次发送消息
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE); // 获取当前批次的消息
    await client.messageBridge.batchSendMessages({ messages: batch });
  }
}
