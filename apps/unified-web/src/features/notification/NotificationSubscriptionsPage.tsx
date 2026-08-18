import { CloseOutlined, SaveOutlined } from "@ant-design/icons";
import { App, Button, Space, Switch, Table, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useNotificationNoticeTypesQuery,
  useNotificationSubscriptionsQuery,
  useUpdateNotificationSubscriptionsMutation,
} from "src/features/notification/queries";
import type { NotificationSubscriptionConfig } from "src/features/notification/types";
import { styled } from "styled-components";

const FooterActions = styled.div`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-top: 12px;
`;

export function NotificationSubscriptionsPage() {
  const { i18n, t } = useTranslation("notification");
  const { message } = App.useApp();
  const subscriptionsQuery = useNotificationSubscriptionsQuery(i18n.language);
  const noticeTypesQuery = useNotificationNoticeTypesQuery();
  const updateMutation = useUpdateNotificationSubscriptionsMutation();
  const [configs, setConfigs] = useState<NotificationSubscriptionConfig[]>([]);
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    if (subscriptionsQuery.data) {
      setConfigs(structuredClone(subscriptionsQuery.data));
      setChanged(false);
    }
  }, [subscriptionsQuery.data]);

  const noticeTypeTitle = (noticeType: number) => {
    switch (noticeType) {
      case 0:
        return t("noticeType.siteMessage", "站内消息");
      case 1:
        return t("noticeType.sms", "短信");
      case 2:
        return t("noticeType.email", "邮箱");
      case 3:
        return t("noticeType.officialAccount", "公众号");
      case 4:
        return t("noticeType.weCom", "企业微信");
      case 5:
        return t("noticeType.dingTalk", "钉钉");
      case 6:
        return t("noticeType.lark", "飞书");
      default:
        return String(noticeType);
    }
  };

  const columns = useMemo<ColumnsType<NotificationSubscriptionConfig>>(
    () => [
      {
        title: t("subscription.useSubscriptionColumns.messageType", "消息类型"),
        dataIndex: "title",
        fixed: "left",
      },
      {
        title: t("subscription.useSubscriptionColumns.category", "分类"),
        dataIndex: "category",
      },
      ...(noticeTypesQuery.data ?? []).map((noticeType) => ({
        title: noticeTypeTitle(noticeType),
        key: String(noticeType),
        align: "center" as const,
        render: (_: unknown, record: NotificationSubscriptionConfig) => {
          const noticeConfig = record.noticeConfigs.find((config) => config.noticeType === noticeType);
          if (!noticeConfig) return "-";
          const tooltip = noticeConfig.canUserModify
            ? undefined
            : noticeConfig.enabled
              ? t("subscription.useSubscriptionColumns.unableToCancelPrompt", "系统设置，不支持关闭")
              : t("subscription.useSubscriptionColumns.unableToOpenPrompt", "系统未开启对应通知");
          return (
            <Tooltip title={tooltip}>
              <Switch
                checked={noticeConfig.enabled}
                disabled={!noticeConfig.canUserModify}
                onChange={(enabled) => {
                  setConfigs((current) =>
                    current.map((config) =>
                      config.messageType === record.messageType
                        ? {
                            ...config,
                            noticeConfigs: config.noticeConfigs.map((item) =>
                              item.noticeType === noticeType ? { ...item, enabled } : item,
                            ),
                          }
                        : config,
                    ),
                  );
                  setChanged(true);
                }}
              />
            </Tooltip>
          );
        },
      })),
    ],
    [noticeTypesQuery.data, t],
  );

  const save = async () => {
    try {
      await updateMutation.mutateAsync(configs);
      setChanged(false);
      message.success(t("subscription.subscriptionTable.saveSuccess", "保存成功"));
    } catch {
      message.error(t("subscription.subscriptionTable.saveError", "保存数据出错"));
    }
  };

  return (
    <>
      <Table
        bordered
        rowKey="messageType"
        loading={subscriptionsQuery.isLoading || noticeTypesQuery.isLoading}
        columns={columns}
        dataSource={configs}
        pagination={false}
        scroll={{ x: "max-content" }}
      />
      {changed ? (
        <FooterActions>
          <Space>
            <Button
              type="text"
              size="small"
              icon={<CloseOutlined />}
              onClick={() => {
                setConfigs(structuredClone(subscriptionsQuery.data ?? []));
                setChanged(false);
              }}
            >
              {t("common.cancel", "取消")}
            </Button>
            <Button
              type="link"
              size="small"
              icon={<SaveOutlined />}
              loading={updateMutation.isPending}
              onClick={() => void save()}
            >
              {t("common.save", "保存")}
            </Button>
          </Space>
        </FooterActions>
      ) : null}
    </>
  );
}
