import { AdminMessageType } from "@scow/lib-web/build/models/notification";
import { Button, notification, Space, Typography } from "antd";
import { useEffect, useRef } from "react";
import { api } from "src/apis";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { RenderContent, renderingMessage } from "src/utils/renderingMessage";

const { Title } = Typography;

interface NotificationLayoutProps {
  children: React.ReactNode;
  interval?: number; // 定时器的时间间隔，默认60秒
}

const p = prefix("notifLayout.");

const NotificationLayout: React.FC<NotificationLayoutProps> = ({ children, interval = 60000 }) => {

  const t = useI18nTranslateToString();
  const [notifApi, contextHolder] = notification.useNotification();
  const notifiedIdsRef = useRef<Set<number>>(new Set()); // 用于追踪已通知的ID
  const currentLanguage = useI18n().currentLanguage;
  const readIdsRef = useRef<Set<number>>(new Set()); // 用于追踪已标记为已读的 ID

  const close = async (messageId: number) => {
    if (!readIdsRef.current.has(messageId)) {
      await api.markMessageRead({ body: { messageId } });

      readIdsRef.current.add(messageId); // 标记为已读
    }
    notifApi.destroy(messageId);
  };

  const openNotification = (content: RenderContent) => {
    const key = content.id;
    const btn = (
      <Space>
        <Button
          style={{ boxShadow: "none" }}
          type="primary"
          size="small"
          onClick={() => close(content.id)}
        >
          {t(p("read"))}
        </Button>
      </Space>
    );
    notifApi.open({
      message: <Title level={5}>{content.title}</Title>,
      description: content.description,
      btn,
      key,
      duration: 0,
      onClose: () => close(key),
    });
  };

  useEffect(() => {
    const fetchNotifications = async () => {
      const results = await api.getUnreadMessage({
        query: { messageType: AdminMessageType.SystemNotification },
      }).httpError(500, () => {}).then((res) => res).catch(() => undefined);

      if (results) {
        for (const msg of results.results.messages) {
          const content = renderingMessage(msg, currentLanguage.id);

          // 使用 ref 来检查已通知的 ID
          if (content && !notifiedIdsRef.current.has(msg.id)) {
            openNotification(content);
            notifiedIdsRef.current.add(msg.id); // 更新 ref 中的 ID 集合
          }
        }
      }
    };

    fetchNotifications();

    // 定时器，按指定的时间间隔调用
    const timer = setInterval(() => {
      fetchNotifications();
    }, interval);

    // 清除定时器
    return () => clearInterval(timer);
  }, [interval, currentLanguage.id]);

  return (
    <div>
      {contextHolder}
      {children}
    </div>
  );
};

export default NotificationLayout;
