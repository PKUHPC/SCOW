import { SqlEntityManager } from "@mikro-orm/mysql";
import { Template } from "src/models/message-type";
import { NoticeType } from "src/models/notice-type";
import { AdminMessageConfig } from "src/server/entities/AdminMessageConfig";
import { enabledNoticeTypes } from "src/utils/message/check-message";

import { checkMessageTypeExist, getAllMessageTypesData } from "./message-type";

interface MessageNoticeTypeConfig {
  noticeType: NoticeType;
  canUserModify: boolean;
  enabled: boolean;
}

export interface MessageConfig {
  messageType: string;
  titleTemplate: Template | undefined;
  category: string | undefined;
  categoryTemplate: Template | undefined;
  noticeConfigs: MessageNoticeTypeConfig[];
}

export const getMessageConfigsWithDefault = async (em: SqlEntityManager) => {
  const [adminConfigs, totalCount] = await em.findAndCount(AdminMessageConfig, {});

  const adminConfigMap = new Map<string, MessageConfig>();

  // 处理已存入数据库消息设置
  for (const config of adminConfigs) {
    if (!enabledNoticeTypes.includes(config.noticeType)) {
      continue;
    }
    const key = config.messageType;
    const noticeConfig: MessageNoticeTypeConfig = {
      noticeType: config.noticeType,
      canUserModify: config.canUserModify,
      enabled: config.enabled,
    };

    if (adminConfigMap.has(key)) {
      adminConfigMap.get(key)?.noticeConfigs.push(noticeConfig);
    } else {
      const messageTypeData = await checkMessageTypeExist(em, config.messageType);
      if (messageTypeData) {
        adminConfigMap.set(key, {
          messageType: config.messageType,
          titleTemplate: messageTypeData.titleTemplate,
          category: messageTypeData.category,
          categoryTemplate: messageTypeData.categoryTemplate,
          noticeConfigs: [noticeConfig],
        });
      }
    }
  }

  // 处理未存入数据库的消息设置，主要是未设置过的自定义消息及其通知方式
  const defaultNoticeConfig = { canUserModify: false, enabled: false };
  const messageTypes = await getAllMessageTypesData(em);

  for (const messageType of messageTypes) {
    for (const noticeType of enabledNoticeTypes) {
      const key = messageType.type;

      if (!adminConfigMap.has(key)) {
        adminConfigMap.set(key, {
          messageType: messageType.type,
          titleTemplate: messageType.titleTemplate,
          category: messageType.category,
          categoryTemplate: messageType.categoryTemplate,
          noticeConfigs: [],
        });
      }

      const noticeConfigs = adminConfigMap.get(key)?.noticeConfigs;
      if (noticeConfigs && !noticeConfigs.some((nc) => nc.noticeType === noticeType)) {
        noticeConfigs.push({
          ...defaultNoticeConfig,
          noticeType,
        });
      }
    }
  }

  const mergedResults = Array.from(adminConfigMap.values());

  return {
    totalCount,
    mergedResults,
  };
};

export const getMessageTypeAdminConfigsWithDefault = async (em: SqlEntityManager, messageType: string) => {
  const results = await Promise.all(
    enabledNoticeTypes.map(async (noticeType) => {
      return getMessageConfigWithDefault(em, messageType, noticeType);
    }),
  );

  return results;
};

export const getMessageConfigWithDefault = async (
  em: SqlEntityManager,
  messageType: string,
  noticeType: NoticeType,
) => {
  const defaultNoticeConfig = { canUserModify: false, enabled: false };
  return (
    (await em.findOne(AdminMessageConfig, { messageType, noticeType })) ?? {
      messageType,
      noticeType,
      ...defaultNoticeConfig,
    }
  );
};
