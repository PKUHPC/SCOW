import type { NotificationApi, NotificationMessage, NotificationSubscriptionConfig } from "src/features/notification/types";

let messages: NotificationMessage[] = [
  {
    id: "1003",
    messageType: "AiJobFinished",
    title: "训练任务已完成",
    content: "训练任务 image-classification 已成功完成。",
    category: "Job",
    isRead: false,
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    id: "1002",
    messageType: "AccountBalanceWarning",
    title: "账户余额提醒",
    content: "账户 project-a 的可用余额低于提醒阈值。",
    category: "Account",
    isRead: false,
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
  {
    id: "1001",
    messageType: "SystemNotification",
    title: "系统维护通知",
    content: "平台将在本周六 02:00 至 04:00 进行例行维护。",
    category: "Admin",
    isRead: false,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
];

let subscriptions: NotificationSubscriptionConfig[] = [
  {
    messageType: "JOB_FINISHED",
    title: "作业结束通知",
    category: "作业通知",
    noticeConfigs: [
      { noticeType: 0, enabled: true, canUserModify: false },
      { noticeType: 2, enabled: true, canUserModify: true },
      { noticeType: 4, enabled: false, canUserModify: true },
    ],
  },
  {
    messageType: "ACCOUNT_BALANCE_WARNING",
    title: "账户余额提醒",
    category: "账户通知",
    noticeConfigs: [
      { noticeType: 0, enabled: true, canUserModify: false },
      { noticeType: 2, enabled: false, canUserModify: true },
      { noticeType: 4, enabled: true, canUserModify: true },
    ],
  },
];

const wait = () => new Promise((resolve) => setTimeout(resolve, 200));

export const mockNotificationClient: NotificationApi = {
  async listMessages(input) {
    await wait();
    const filtered = messages.filter(
      (message) =>
        (!input.category || message.category === input.category) &&
        (!input.messageTypes?.length || input.messageTypes.includes(message.messageType)) &&
        (!input.unreadOnly || !message.isRead),
    );
    const start = (input.page - 1) * input.pageSize;
    return {
      messages: filtered.slice(start, start + input.pageSize),
      totalCount: filtered.length,
    };
  },
  async markMessageRead(messageId) {
    await wait();
    messages = messages.map((message) => (message.id === messageId ? { ...message, isRead: true } : message));
  },
  async markAllMessagesRead() {
    await wait();
    messages = messages.map((message) => ({ ...message, isRead: true }));
  },
  async deleteMessages(messageIds) {
    await wait();
    messages = messages.filter((message) => !messageIds.includes(message.id));
  },
  async deleteAllReadMessages() {
    await wait();
    messages = messages.filter((message) => !message.isRead);
  },
  async listNoticeTypes() {
    await wait();
    return [0, 2, 4];
  },
  async listSubscriptions() {
    await wait();
    return structuredClone(subscriptions);
  },
  async updateSubscriptions(configs) {
    await wait();
    subscriptions = structuredClone(configs);
  },
};
