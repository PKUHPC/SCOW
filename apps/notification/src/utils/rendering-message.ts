import { JsonValue } from "@bufbuild/protobuf";
import { Message } from "@scow/notification-protos/build/message_pb";
import { AdminMessageType, adminMessageTypesMap } from "src/models/message-type";
import { CustomMessageType } from "src/server/entities/CustomMessageType";

import { formatDateTime } from "./datetime";

export interface RenderContent {
  id: bigint;
  title: string;
  content: string;
  createdAt: string;
}

enum TemplateLang {
  Default = "default",
  EN = "en",
  zhCn = "zhCn",
};

export const checkAdminMessageTypeExist = (type: string): CustomMessageType | null => {
  if (adminMessageTypesMap.has(type as AdminMessageType)) {
    return { type, ...adminMessageTypesMap.get(type as AdminMessageType) } as CustomMessageType;
  }

  return null;
};

export function replaceTemplate(metadata: JsonValue, template: string): string {

  if (!metadata) return "";

  return template.replace(/\{__(.*?)__\}/g, (match, p1) => {
    const value = p1 === "time" ? formatDateTime(metadata[p1] as string) : metadata[p1] as string;
    return value !== undefined ? value : match;
  });
}


function checkTemplateNotUndefined(message: Message) {
  if (message.messageType?.titleTemplate === undefined) return false;
  if (message.messageType.categoryTemplate === undefined) return false;
  if (message.messageType.contentTemplate === undefined) return false;

  return true;
}

function parseAdminMessage(message: Message): RenderContent | undefined {
  const fields = message.metadata;

  if (!fields) return undefined;

  return {
    id: message.id,
    // eslint-disable-next-line @typescript-eslint/dot-notation
    title: fields["title"] as string,
    // eslint-disable-next-line @typescript-eslint/dot-notation
    content: fields["content"] as string,
    createdAt: formatDateTime(message.createdAt),
  };
}

export const renderingMessage = (message: Message, languageId: string): RenderContent | undefined => {
  if (!message.messageType || !message.metadata) return undefined;

  if (checkAdminMessageTypeExist(message.messageType.type)) {
    return parseAdminMessage(message);
  } else if (checkTemplateNotUndefined(message)) {

    let templateLang: TemplateLang = TemplateLang.Default;
    if (languageId === "en") {
      templateLang = TemplateLang.EN;
    } else if (languageId === "zh_cn") {
      templateLang = TemplateLang.zhCn;
    }
    // 对应语言模板没有设置时采用默认模板
    const messageType = message.messageType;
    const titleTemplate =
      messageType.titleTemplate?.[templateLang] || messageType.titleTemplate!.default;
    const contentTemplate =
      messageType.contentTemplate?.[templateLang] || messageType.contentTemplate!.default;

    return {
      id: message.id,
      title: titleTemplate,
      content: replaceTemplate(message.metadata, contentTemplate),
      createdAt: formatDateTime(message.createdAt),
    };
  } else {
    return {
      id: message.id,
      title: message.messageType.type,
      content: JSON.stringify(message.metadata),
      createdAt: formatDateTime(message.createdAt),
    };
  }
};
