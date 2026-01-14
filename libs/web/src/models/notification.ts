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

export const adminMessageTypesMap = new Map<AdminMessageType, MessageTypeInfo>([
  [AdminMessageType.SystemNotification, {
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
  }],
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
