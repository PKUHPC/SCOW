import { Card, List, Typography } from "antd";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useNotificationMessagesQuery } from "src/features/notification";
import { styled } from "styled-components";

const NotifContainer = styled.div`
  height: 100%;
  .ant-card .ant-card-body {
    padding: 12px 24px !important;
  }
`;

const NotifTitle = styled.div`
  font-size: 14px;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export function NotificationCard() {
  const { i18n, t } = useTranslation("dashboard");
  const navigate = useNavigate();
  const messagesQuery = useNotificationMessagesQuery({
    page: 1,
    pageSize: 10,
    unreadOnly: true,
    language: i18n.language,
  });

  return (
    <NotifContainer>
      <Card
        style={{ height: "100%", boxShadow: "#0000000D 0px 4px 4px 0px" }}
        loading={messagesQuery.isLoading}
        title={t("dashboard.notificationCard.message", "消息")}
        extra={
          <Typography.Link onClick={() => void navigate("/notification/messages")}>
            {t("dashboard.notificationCard.check", "查看全部 >")}
          </Typography.Link>
        }
      >
        <List
          itemLayout="horizontal"
          locale={{
            emptyText: messagesQuery.isError
              ? t("dashboard.notificationCard.fetchError", "获取未读消息失败")
              : t("dashboard.notificationCard.noMessage", "当前没有未读消息"),
          }}
          dataSource={(messagesQuery.data?.messages ?? []).slice(0, 3)}
          renderItem={(item) => (
            <List.Item key={item.id} style={{ borderBottom: "none", padding: "4px 0" }}>
              <List.Item.Meta
                style={{ background: "#FAFAFA", borderRadius: "8px", padding: "12px 22px" }}
                title={<NotifTitle>{item.title}</NotifTitle>}
                description={
                  <Typography.Text
                    style={{ fontWeight: 350, fontSize: "14px", color: "#43434399" }}
                    ellipsis
                  >
                    {item.content}
                  </Typography.Text>
                }
              />
            </List.Item>
          )}
        />
      </Card>
    </NotifContainer>
  );
}
