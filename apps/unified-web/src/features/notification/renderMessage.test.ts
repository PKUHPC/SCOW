import { create, type JsonObject } from "@bufbuild/protobuf";
import { TemplateSchema } from "@scow/notification-protos/build/common_pb";
import { MessageSchema } from "@scow/notification-protos/build/message_pb";
import { MessageTypeSchema } from "@scow/notification-protos/build/message_type_pb";
import { renderNotificationMessage } from "src/features/notification/renderMessage";

const createMessage = ({
  type = "AccountUserSyncResult",
  metadata = {},
  titleTemplate = { default: "默认标题", zhCn: "中文标题", en: "English title" },
  contentTemplate,
  descriptions = [],
}: {
  type?: string;
  metadata?: JsonObject;
  titleTemplate?: { default: string; zhCn?: string; en?: string };
  contentTemplate?: { default: string; zhCn?: string; en?: string };
  descriptions?: string[];
}) =>
  create(MessageSchema, {
    id: 1n,
    messageType: create(MessageTypeSchema, {
      type,
      category: "Account",
      titleTemplate: create(TemplateSchema, titleTemplate),
      contentTemplate: contentTemplate ? create(TemplateSchema, contentTemplate) : undefined,
    }),
    metadata,
    descriptions,
    createdAt: "2026-07-15T08:09:10",
  });

describe("renderNotificationMessage", () => {
  test("renders system notification title and content directly", () => {
    const message = createMessage({
      type: "SystemNotification",
      metadata: { title: "维护通知", content: "今晚进行系统维护" },
    });

    expect(renderNotificationMessage(message, "zh_cn")).toMatchObject({
      title: "维护通知",
      content: "今晚进行系统维护",
    });
  });

  test("renders localized metadata instead of its JSON representation", () => {
    const message = createMessage({
      metadata: {
        time: "2026-07-15T08:09:10",
        messageStatus: "Completed",
        syncI18nClusterNames: {
          i18n: { default: "ai1，slurm1", zhCn: "ai1，slurm1", en: "ai1, slurm1" },
        },
      },
      contentTemplate: {
        default: "{__time__}|{__messageStatus__}|{__syncI18nClusterNames__}",
        zhCn: "{__time__}|{__messageStatus__}|{__syncI18nClusterNames__}",
        en: "{__time__}|{__messageStatus__}|{__syncI18nClusterNames__}",
      },
    });

    expect(renderNotificationMessage(message, "zh_cn").content).toBe("2026-07-15 08:09:10|完成|ai1，slurm1");
    expect(renderNotificationMessage(message, "en").content).toBe("2026-07-15 08:09:10|COMPLETED|ai1, slurm1");
  });

  test("does not expose raw metadata when a template is unavailable", () => {
    const message = createMessage({
      metadata: { internalPayload: { secret: "value" } },
      descriptions: ["可读消息内容"],
    });

    expect(renderNotificationMessage(message, "zh_cn").content).toBe("可读消息内容");
  });

  test("keeps an unresolved placeholder visible", () => {
    const message = createMessage({
      contentTemplate: { default: "账户 {__accountName__}" },
    });

    expect(renderNotificationMessage(message, "zh_cn").content).toBe("账户 {__accountName__}");
  });
});
