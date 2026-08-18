import { Card, Tabs } from "antd";
import { useTranslation } from "react-i18next";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

export function NotificationLayout() {
  const { t } = useTranslation("notification");
  const location = useLocation();
  const navigate = useNavigate();
  const activeKey = location.pathname.includes("/subscriptions") ? "subscriptions" : "messages";

  return (
    <Card styles={{ body: { paddingTop: 0 } }}>
      <Tabs
        activeKey={activeKey}
        items={[
          { key: "messages", label: t("api.myMsgs", "我的消息") },
          { key: "subscriptions", label: t("api.msgSub", "消息接收设置") },
        ]}
        onChange={(key) => void navigate(`/notification/${key}`)}
      />
      <Outlet />
    </Card>
  );
}
