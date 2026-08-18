import { App as AntdApp, Button, Typography } from "antd";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useMetadataQuery } from "src/api/metadata";
import {
  useMarkNotificationReadMutation,
  useUnreadPopupNotificationsQuery,
} from "src/features/notification/queries";

export function NotificationPopupPoller() {
  const { i18n, t } = useTranslation("notification");
  const metadataQuery = useMetadataQuery();
  const notificationEnabled = metadataQuery.data ? Boolean(metadataQuery.data.components.notification) : true;
  const unreadMessagesQuery = useUnreadPopupNotificationsQuery(i18n.language, notificationEnabled);
  const markReadMutation = useMarkNotificationReadMutation();
  const { notification: notificationApi } = AntdApp.useApp();
  const displayedMessageIds = useRef(new Set<string>());
  const requestedReadMessageIds = useRef(new Set<string>());

  useEffect(() => {
    const markRead = (messageId: string) => {
      if (requestedReadMessageIds.current.has(messageId)) return;

      requestedReadMessageIds.current.add(messageId);
      void markReadMutation.mutateAsync(messageId).catch(() => {
        requestedReadMessageIds.current.delete(messageId);
      });
    };

    for (const message of unreadMessagesQuery.data?.messages ?? []) {
      if (displayedMessageIds.current.has(message.id)) continue;

      displayedMessageIds.current.add(message.id);
      notificationApi.open({
        key: message.id,
        message: <Typography.Title level={5}>{message.title}</Typography.Title>,
        description: message.content,
        duration: 0,
        btn: (
          <Button
            type="primary"
            size="small"
            style={{ boxShadow: "none" }}
            onClick={() => {
              markRead(message.id);
              notificationApi.destroy(message.id);
            }}
          >
            {t("notification.popup.read", "已读")}
          </Button>
        ),
        onClose: () => markRead(message.id),
      });
    }
  }, [markReadMutation, notificationApi, t, unreadMessagesQuery.data?.messages]);

  return null;
}
