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

import { Code, ConnectError, ConnectRouter } from "@connectrpc/connect";
import { MessageConfigService } from "@scow/notification-protos/build/message_config_pb";
import { NoticeType } from "src/models/notice-type";
import { PlatformRole } from "src/models/user";
import { AdminMessageConfig } from "src/server/entities/AdminMessageConfig";
import { checkAuth } from "src/utils/auth/check-auth";
import { ensureNotUndefined } from "src/utils/ensure-not-undefined";
import { forkEntityManager } from "src/utils/get-orm";
import { checkNoticeTypeEnabled } from "src/utils/message/check-message";
import { getMessageConfigsWithDefault } from "src/utils/message-config";
import { checkMessageTypeExist, findInInternalMessageTypesMap } from "src/utils/message-type";

export default (router: ConnectRouter) => {
  router.service(MessageConfigService, {
    async createMessageConfig(req, context) {

      const user = await checkAuth(context);

      const { noticeType, messageType, enabled, canUserModify } =
        ensureNotUndefined(req, ["noticeType", "messageType", "enabled", "canUserModify"]);

      if (!user.platformRoles.includes(PlatformRole.PLATFORM_ADMIN)) {
        throw new ConnectError(
          `User ${user.identityId} unable to modify message config`,
          Code.PermissionDenied,
        );
      }

      const em = await forkEntityManager();

      // 查看自定义消息类型中是否已经存在
      const messageTypeData = await checkMessageTypeExist(em, messageType);
      if (!messageTypeData) {
        throw new ConnectError(
          `Message type ${messageType} does't exists.`,
          Code.AlreadyExists,
        );
      }

      // 查看通知方式是否被配置开启
      if (!checkNoticeTypeEnabled(noticeType)) {
        throw new ConnectError(
          `The notification type ${noticeType} is not enabled`,
          Code.InvalidArgument,
        );
      }

      // 查看是否已经有这个相关的配置
      const adminMessageConfig = await em.findOne(AdminMessageConfig, { messageType, noticeType });

      if (adminMessageConfig) {
        throw new ConnectError(
          `Message config ${messageType}-${noticeType} already exist`,
          Code.AlreadyExists,
        );
      }

      // 检查是否是内置类型，内置类型的站内消息发送相关配置不可更改
      if (noticeType === NoticeType.SITE_MESSAGE && findInInternalMessageTypesMap(messageType).length > 0) {
        throw new ConnectError(
          `Built-in message types ${messageType} cannot be created again.`,
          Code.InvalidArgument,
        );
      }

      const newConfig = new AdminMessageConfig({
        messageType,
        noticeType,
        enabled,
        canUserModify,
      });

      await em.persistAndFlush(newConfig);

      return {};
    },

    async modifyMessageConfigs(req, context) {

      const user = await checkAuth(context);

      if (!user.platformRoles.includes(PlatformRole.PLATFORM_ADMIN)) {
        throw new ConnectError(
          `User ${user.identityId} unable to modify message config`,
          Code.PermissionDenied,
        );
      }

      const { configs } = req;

      const em = await forkEntityManager();

      const newConfigs: AdminMessageConfig[] = [];
      const updateConfigs: AdminMessageConfig[] = [];

      for (const config of configs) {
        const { messageType, noticeConfigs } = config;

        // 查看自定义消息类型中是否有这消息类型
        const messageTypeData = await checkMessageTypeExist(em, messageType);
        if (!messageTypeData) {
          throw new ConnectError(
            `Message type ${messageType} does't exists.`,
            Code.InvalidArgument,
          );
        }

        for (const noticeConfig of noticeConfigs) {

          const { noticeType, enabled, canUserModify } = noticeConfig;

          // noticeType 不能为 undefined
          if (noticeType === undefined) {
            throw new ConnectError(
              "noticeType cannot be undefined",
              Code.InvalidArgument,
            );
          }
          // 查看通知方式是否开启
          if (!checkNoticeTypeEnabled(noticeType)) {
            throw new ConnectError(
              `The notification type ${noticeType} is not enabled`,
              Code.InvalidArgument,
            );
          }

          // 检查是否是内置类型，内置类型的站内消息发送相关配置不可更改
          // if (noticeType === NoticeType.SITE_MESSAGE && findInInternalMessageTypesMap(messageType).length > 0) {
          //   throw new ConnectError(
          //     `Built-in message types ${messageType} cannot be modified.`,
          //     Code.InvalidArgument,
          //   );
          // }

          // 查看是否已经有这个相关的配置
          const adminMessageConfig = await em.findOne(AdminMessageConfig, { messageType, noticeType });

          if (!adminMessageConfig) {
            newConfigs.push(new AdminMessageConfig({
              messageType,
              noticeType,
              enabled: enabled ?? false,
              canUserModify: canUserModify ?? false,
            }));
          } else {
            adminMessageConfig.enabled = enabled ?? adminMessageConfig.enabled;
            // 开启状态下才能修改 canUserModify
            if (adminMessageConfig.enabled) {
              adminMessageConfig.canUserModify = canUserModify ?? adminMessageConfig.canUserModify;
            }
            updateConfigs.push(adminMessageConfig);
          }
        }
      }

      if (newConfigs.length > 0) {
        em.persist(newConfigs);
      }

      if (updateConfigs.length > 0) {
        em.persist(updateConfigs);
      }

      await em.flush();
      return {};
    },

    async listMessageConfigs(req, context) {

      const user = await checkAuth(context);

      if (!user.platformRoles.includes(PlatformRole.PLATFORM_ADMIN)) {
        throw new ConnectError(
          `User ${user.identityId} unable to modify message config`,
          Code.PermissionDenied,
        );
      }
      const em = await forkEntityManager();

      // 管理员的配置中不一定涉及到所有的【消息类型】-【通知类型】，未配置的需采用默认值
      // 前端分页
      const { mergedResults, totalCount } = await getMessageConfigsWithDefault(em);

      return {
        totalCount,
        configs: mergedResults,
      };
    },
  });
};
