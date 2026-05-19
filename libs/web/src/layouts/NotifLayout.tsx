import { Button, notification, Space, Typography } from "antd";
import { useEffect, useRef } from "react";
import { getCurrentLangLibWebText } from "src/utils/libWebI18n/libI18n";
import { Message, RenderContent, renderingMessage } from "src/utils/renderingMessage";

const { Title } = Typography;

interface UnreadMessage {
  totalCount: number;
  messages: Message[];
}

interface NotificationLayoutProps {
  children: React.ReactNode;
  languageId: string;
  onMarkMessageRead: (messageId: number) => Promise<void>;
  interval?: number; // 定时器的时间间隔，默认60秒
  fetchUnreadMessages: () => Promise<UnreadMessage | undefined>;
}

const NotificationLayout: React.FC<NotificationLayoutProps> = ({
  children,
  languageId,
  onMarkMessageRead,
  fetchUnreadMessages,
  interval = 60000,
}) => {
  const [notifApi, contextHolder] = notification.useNotification();
  const notifiedIdsRef = useRef<Set<number>>(new Set()); // 用于追踪已通知的ID
  const readIdsRef = useRef<Set<number>>(new Set()); // 用于追踪已标记为已读的 ID

  const close = async (messageId: number) => {
    if (!readIdsRef.current.has(messageId)) {
      await onMarkMessageRead(messageId);
      readIdsRef.current.add(messageId);
    }
    notifApi.destroy(messageId);
  };

  const openNotification = (content: RenderContent) => {
    const key = content.id;
    const btn = (
      <Space>
        <Button style={{ boxShadow: "none" }} type="primary" size="small" onClick={() => close(key)}>
          {getCurrentLangLibWebText(languageId, "read")}
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
      const unreadMessages = await fetchUnreadMessages();
      if (unreadMessages) {
        for (const msg of unreadMessages.messages) {
          const content = renderingMessage(msg, languageId);

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
  }, [interval, languageId, fetchUnreadMessages]);

  return (
    <div>
      {contextHolder}
      {children}
    </div>
  );
};

export default NotificationLayout;
