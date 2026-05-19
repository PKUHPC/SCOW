export interface CustomMessageType {
  type: string;
  titleTemplate: Template;
  contentTemplate: Template;
  category: string;
  categoryTemplate: Template;
  createdAt: string;
  updatedAt: string;
}
export interface Template {
  default: string;
  en?: string;
  zhCn?: string;
}

export interface MessageTypeInfo {
  type: string;
  titleTemplate: Template;
  category: string;
  categoryTemplate: Template;
  contentTemplate: Template;
}

export enum AdminMessageType {
  SystemNotification = "SystemNotification",
}

export enum InternalMessageType {
  AccountOverdue = "AccountOverdue",
  AccountRechargeSuccess = "AccountRechargeSuccess",
  AccountLowBalance = "AccountLowBalance",
  AccountBalance = "AccountBalance",
  AccountLocked = "AccountLocked",
  AccountUnblocked = "AccountUnblocked",
  JobStarted = "JobStarted",
  JobFinished = "JobFinished",
  JobAbnormalTermination = "JobAbnormalTermination",
  AccountUserSyncResult = "AccountUserSyncResult",
  MonitorAlert = "MonitorAlert",
}

export const adminMessageTypesMap = new Map<AdminMessageType, MessageTypeInfo>([
  [
    AdminMessageType.SystemNotification,
    {
      type: "SystemNotification",
      titleTemplate: {
        default: "系统公告",
        en: "System Notification",
        zhCn: "系统公告",
      },
      category: "Admin",
      categoryTemplate: {
        default: "Admin Messages",
        en: "Admin Messages",
        zhCn: "管理员消息",
      },
      contentTemplate: {
        default: "",
      },
    },
  ],
]);

export enum MessageStatus {
  // 异常
  EXCEPTION = "Exception",
  // 完成
  COMPLETED = "Completed",
  // 其他
}
export const CONTENT_FIELD_I18N_MAP: Record<string, Record<string, Template>> = {
  messageStatus: {
    [MessageStatus.COMPLETED]: {
      default: "完成",
      en: "COMPLETED",
      zhCn: "完成",
    },
    [MessageStatus.EXCEPTION]: {
      default: "异常",
      en: "EXCEPTION",
      zhCn: "异常",
    },
  },
};
