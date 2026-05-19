import { NotifContainer, NotifTitle } from "@scow/lib-web/build/components/NotificationCard";
import { RenderContent, renderingMessage } from "@scow/lib-web/build/utils/renderingMessage";
import { App, Card, List, Typography } from "antd";
import { useRouter } from "next/navigation";
import React from "react";
import { usePublicConfig } from "src/app/(auth)/context";
import { Localized, prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { useDarkMode } from "src/layouts/darkMode";
import { trpc } from "src/utils/trpc";

const { Text } = Typography;

const p = prefix("app.dashboard.notificationCard.");

export const NotificationCard: React.FC = () => {
  const { publicConfig } = usePublicConfig();

  const { message } = App.useApp();
  const t = useI18nTranslateToString();
  const router = useRouter();
  const { dark } = useDarkMode();

  const currentLanguage = useI18n().currentLanguage;

  const { data, isLoading } = trpc.notification.getUnreadMessages.useQuery({
    page: 1,
    pageSize: 10,
  });

  const getMsgContents = (): RenderContent[] => {
    try {
      const msgsToRender: RenderContent[] = [];
      for (const msg of data?.results?.messages || []) {
        const renderMsg = renderingMessage(msg, currentLanguage.id);
        if (renderMsg !== undefined) msgsToRender.push(renderMsg);

        if (msgsToRender.length >= 3) break;
      }
      return msgsToRender;
    } catch {
      message.error(t(p("fetchNotifError")));
      return [];
    }
  };

  return (
    <NotifContainer>
      <Card
        style={{ height: "100%", boxShadow: "#0000000D 0px 4px 4px 0px" }}
        loading={isLoading}
        title={
          <>
            <Localized id={p("message")} />
          </>
        }
        extra={
          <a onClick={() => router.push(`/extensions/${publicConfig.NOTIF_NAME!}/notification`)}>{t(p("check"))}</a>
        }
      >
        <List
          itemLayout="horizontal"
          locale={{ emptyText: t(p("noMessage")) }}
          dataSource={getMsgContents()}
          renderItem={(item) => (
            <List.Item key={item.id} style={{ borderBottom: "none", padding: "4px 0" }}>
              <List.Item.Meta
                style={{
                  ...(dark ? { background: "#282828" } : { background: "#FAFAFA" }),
                  borderRadius: "8px",
                  padding: "12px 22px",
                }}
                title={(
                  <NotifTitle>
                    {item.title}
                  </NotifTitle>
                )}
                description={(
                  <Text
                    style={{ fontWeight: 350, fontSize: "14px", color: dark ? "#FFFFFF99" : "#43434399" }}
                    ellipsis={true}
                  >
                    {item.description}
                  </Text>
                )}
              />
            </List.Item>
          )}
        />
      </Card>
    </NotifContainer>
  );
};
