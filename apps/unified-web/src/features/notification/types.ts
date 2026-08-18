export const SITE_MESSAGE_NOTICE_TYPE = 0;
export const POPUP_NOTIFICATION_MESSAGE_TYPES = ["SystemNotification", "MonitorAlert"] as const;

export interface NotificationMessage {
  id: string;
  messageType: string;
  title: string;
  content: string;
  category: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationMessagePage {
  messages: NotificationMessage[];
  totalCount: number;
}

export interface ListNotificationMessagesInput {
  category?: string;
  messageTypes?: readonly string[];
  page: number;
  pageSize: number;
  unreadOnly?: boolean;
  language: string;
}

export interface NotificationNoticeConfig {
  noticeType: number;
  enabled: boolean;
  canUserModify: boolean;
}

export interface NotificationSubscriptionConfig {
  messageType: string;
  title: string;
  category: string;
  noticeConfigs: NotificationNoticeConfig[];
}

export interface NotificationApi {
  listMessages: (input: ListNotificationMessagesInput) => Promise<NotificationMessagePage>;
  markMessageRead: (messageId: string) => Promise<void>;
  markAllMessagesRead: () => Promise<void>;
  deleteMessages: (messageIds: string[]) => Promise<void>;
  deleteAllReadMessages: () => Promise<void>;
  listNoticeTypes: () => Promise<number[]>;
  listSubscriptions: (language: string) => Promise<NotificationSubscriptionConfig[]>;
  updateSubscriptions: (configs: NotificationSubscriptionConfig[]) => Promise<void>;
}
