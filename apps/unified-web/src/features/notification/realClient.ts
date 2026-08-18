import { createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { ReadStatus } from "@scow/notification-protos/build/common_pb";
import { MessageService } from "@scow/notification-protos/build/message_pb";
import { NoticeTypeService } from "@scow/notification-protos/build/notice_type_pb";
import { UserSubscriptionService } from "@scow/notification-protos/build/user_subscription_pb";
import { getDomainApiBase } from "src/api/http";
import { getLocalizedTemplate, renderNotificationMessage } from "src/features/notification/renderMessage";
import type { NotificationApi } from "src/features/notification/types";
import { SITE_MESSAGE_NOTICE_TYPE } from "src/features/notification/types";

const transport = createConnectTransport({
  baseUrl: getDomainApiBase("notification"),
  fetch: (input, init) => fetch(input, { ...init, credentials: "include" }),
});

const messageClient = createClient(MessageService, transport);
const noticeTypeClient = createClient(NoticeTypeService, transport);
const subscriptionClient = createClient(UserSubscriptionService, transport);

export const realNotificationClient: NotificationApi = {
  async listMessages(input) {
    const response = await messageClient.listMessages({
      category: input.category,
      noticeType: SITE_MESSAGE_NOTICE_TYPE,
      readStatus: input.unreadOnly ? ReadStatus.UNREAD : ReadStatus.ALL,
      page: input.page,
      pageSize: input.pageSize,
      messageTypes: input.messageTypes ? [...input.messageTypes] : [],
    });

    return {
      messages: response.messages.map((message) => renderNotificationMessage(message, input.language)),
      totalCount: Number(response.totalCount ?? 0n),
    };
  },
  async markMessageRead(messageId) {
    await messageClient.markMessageRead({ messageId: BigInt(messageId) });
  },
  async markAllMessagesRead() {
    await messageClient.markAllMessagesRead({});
  },
  async deleteMessages(messageIds) {
    await messageClient.deleteMessages({ messageIds: messageIds.map((messageId) => BigInt(messageId)) });
  },
  async deleteAllReadMessages() {
    await messageClient.deleteAllReadMessages({});
  },
  async listNoticeTypes() {
    const response = await noticeTypeClient.listNoticeTypes({});
    return response.noticeTypes;
  },
  async listSubscriptions(language) {
    const response = await subscriptionClient.listUserSubscriptions({});
    return response.configs.map((config) => ({
      messageType: config.messageType,
      title: getLocalizedTemplate(config.titleTemplate, language) || config.messageType,
      category: getLocalizedTemplate(config.categoryTemplate, language) || config.category,
      noticeConfigs: config.noticeConfigs
        .filter((noticeConfig) => noticeConfig.noticeType !== undefined)
        .map((noticeConfig) => ({
          noticeType: noticeConfig.noticeType!,
          enabled: noticeConfig.enabled ?? false,
          canUserModify: noticeConfig.canUserModify ?? false,
        })),
    }));
  },
  async updateSubscriptions(configs) {
    await subscriptionClient.modifyUserSubscription({
      configs: configs.map((config) => ({
        messageType: config.messageType,
        category: config.category,
        noticeConfigs: config.noticeConfigs,
      })),
    });
  },
};
