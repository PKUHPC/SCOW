import { CheckCircleOutlined, DeleteOutlined, MailOutlined } from "@ant-design/icons";
import { App, Badge, Button, Empty, List, Modal, Pagination, Space, Tabs, Tooltip, Typography } from "antd";
import { MouseEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useDeleteAllReadNotificationsMutation,
  useDeleteNotificationsMutation,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useNotificationMessagesQuery,
} from "src/features/notification/queries";
import type { NotificationMessage } from "src/features/notification/types";
import { getLanguageDefinition } from "src/i18n/languages";
import { styled } from "styled-components";

const { Paragraph, Text } = Typography;

const MessageItem = styled(List.Item)<{ $read: boolean }>`
  cursor: pointer;
  padding: 14px 16px !important;
  background: ${({ $read, theme }) => ($read ? theme.token.colorBgContainer : `${theme.token.colorPrimary}0d`)};

  &:hover {
    background: ${({ theme }) => theme.token.colorBgLayout};
  }
`;

const MessageSummary = styled.div`
  min-width: 0;
  flex: 1;
`;

const MessageRow = styled.div`
  width: 100%;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
`;

const MessageMain = styled.div`
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const MessageActions = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const categoryTabs = [
  { key: "all", category: undefined },
  { key: "admin", category: "Admin" },
  { key: "account", category: "Account" },
  { key: "job", category: "Job" },
] as const;

export function NotificationMessagesPage() {
  const { i18n, t } = useTranslation("notification");
  const { message, modal } = App.useApp();
  const [categoryKey, setCategoryKey] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedMessage, setSelectedMessage] = useState<NotificationMessage>();
  const pageSize = 10;
  const dateTimeFormatter = new Intl.DateTimeFormat(getLanguageDefinition(i18n.language).htmlLanguage, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const category = categoryTabs.find((item) => item.key === categoryKey)?.category;
  const messagesQuery = useNotificationMessagesQuery({
    category,
    page,
    pageSize,
    language: i18n.language,
  });
  const markReadMutation = useMarkNotificationReadMutation();
  const markAllReadMutation = useMarkAllNotificationsReadMutation();
  const deleteMutation = useDeleteNotificationsMutation();
  const deleteAllReadMutation = useDeleteAllReadNotificationsMutation();

  const showMessage = async (notification: NotificationMessage) => {
    setSelectedMessage(notification);
    if (!notification.isRead) {
      try {
        await markReadMutation.mutateAsync(notification.id);
      } catch {
        message.error(t("notification.list.markReadError", "标记消息已读失败"));
      }
    }
  };

  const deleteMessage = (event: MouseEvent, notification: NotificationMessage) => {
    event.stopPropagation();
    modal.confirm({
      title: t("notification.list.deleteConfirmTitle", "确认删除"),
      content: t("notification.list.deleteConfirmContent", "确认删除该消息？"),
      onOk: async () => {
        try {
          await deleteMutation.mutateAsync([notification.id]);
          message.success(t("notification.listTable.deleteSuccess", "删除成功"));
        } catch {
          message.error(t("notification.listTable.deleteError", "删除失败"));
        }
      },
    });
  };

  const markAllRead = () =>
    modal.confirm({
      title: t("notification.markAllReadConfirmTitle", "确认全部已读"),
      content: t("notification.markAllReadConfirmContent", "确认将所有消息标记为已读？"),
      onOk: async () => {
        try {
          await markAllReadMutation.mutateAsync();
          message.success(t("notification.markAllReadSuccessInfo", "标记全部已读成功"));
        } catch {
          message.error(t("notification.markAllReadErrorInfo", "标记全部已读失败"));
        }
      },
    });

  const deleteAllRead = () =>
    modal.confirm({
      title: t("notification.deleteReadMsgConfirmTitle", "确认删除已读"),
      content: t("notification.deleteReadMsgConfirmContent", "确认删除所有已读消息？"),
      onOk: async () => {
        try {
          await deleteAllReadMutation.mutateAsync();
          message.success(t("notification.deleteReadMsgSuccessInfo", "删除已读消息成功"));
        } catch {
          message.error(t("notification.deleteReadMsgErrorInfo", "删除已读消息失败"));
        }
      },
    });

  return (
    <>
      <Tabs
        activeKey={categoryKey}
        tabBarExtraContent={
          <Space wrap>
            <Button
              type="text"
              size="small"
              icon={<CheckCircleOutlined />}
              loading={markAllReadMutation.isPending}
              onClick={markAllRead}
            >
              {t("notification.markAllRead", "全部已读")}
            </Button>
            <Button
              danger
              type="text"
              size="small"
              icon={<DeleteOutlined />}
              loading={deleteAllReadMutation.isPending}
              onClick={deleteAllRead}
            >
              {t("notification.deleteReadMsg", "删除已读")}
            </Button>
          </Space>
        }
        items={[
          { key: "all", label: t("notification.listTable.all", "全部") },
          { key: "admin", label: t("notification.listTable.systemNotif", "系统公告") },
          { key: "account", label: t("notification.listTable.accountNotif", "账户通知") },
          { key: "job", label: t("notification.listTable.jobNotif", "作业通知") },
        ]}
        onChange={(key) => {
          setCategoryKey(key);
          setPage(1);
        }}
      />
      {messagesQuery.isError ? (
        <Empty description={t("notification.loadFailed", "加载消息列表失败")} />
      ) : (
        <List
          bordered
          loading={messagesQuery.isLoading}
          locale={{ emptyText: t("notification.adminMessagesTable.noData", "暂无数据") }}
          dataSource={messagesQuery.data?.messages ?? []}
          renderItem={(notification) => (
            <MessageItem $read={notification.isRead} onClick={() => void showMessage(notification)}>
              <MessageRow>
                <MessageMain>
                  <Badge status={notification.isRead ? "default" : "processing"} />
                  <MessageSummary>
                    <Space>
                      <Text strong={!notification.isRead}>{notification.title}</Text>
                      <Text type="secondary">
                        {notification.isRead
                          ? t("notification.list.read", "已读")
                          : t("notification.list.unread", "未读")}
                      </Text>
                    </Space>
                    <Paragraph ellipsis={{ rows: 1 }} type="secondary" style={{ marginBottom: 0 }}>
                      {notification.content}
                    </Paragraph>
                  </MessageSummary>
                </MessageMain>
                <MessageActions>
                  <Text type="secondary">
                    {dateTimeFormatter.format(new Date(notification.createdAt))}
                  </Text>
                  <Tooltip title={t("notification.list.delete", "删除消息")}>
                    <Button
                      aria-label={t("notification.list.delete", "删除消息")}
                      danger
                      type="text"
                      icon={<DeleteOutlined />}
                      onClick={(event) => deleteMessage(event, notification)}
                    />
                  </Tooltip>
                </MessageActions>
              </MessageRow>
            </MessageItem>
          )}
        />
      )}
      <Pagination
        current={page}
        pageSize={pageSize}
        total={messagesQuery.data?.totalCount ?? 0}
        hideOnSinglePage
        style={{ marginTop: 16, textAlign: "right" }}
        onChange={setPage}
      />
      <Modal
        open={selectedMessage !== undefined}
        title={selectedMessage?.title}
        footer={null}
        onCancel={() => setSelectedMessage(undefined)}
      >
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Text type="secondary">
            <MailOutlined /> {selectedMessage ? dateTimeFormatter.format(new Date(selectedMessage.createdAt)) : null}
          </Text>
          <Paragraph style={{ whiteSpace: "pre-wrap" }}>{selectedMessage?.content}</Paragraph>
        </Space>
      </Modal>
    </>
  );
}
