/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { useDarkMode } from "@scow/lib-web/build/layouts/darkMode";
import { App, Card, List, Typography } from "antd";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import { api } from "src/apis";
import { Localized, prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { publicConfig } from "src/utils/config";
import { RenderContent, renderingMessage } from "src/utils/renderingMessage";
import { styled } from "styled-components";

const NotifContainer = styled.div`
  height: 100%;
  .ant-card .ant-card-body {
    padding: 12px 24px !important;
  }
`;

const { Text } = Typography;

interface Props {
  interval?: number; // 定时器的时间间隔，默认60秒
}

const p = prefix("pageComp.dashboard.NotificationCard.");

export const NotificationCard: React.FC<Props> = ({ interval = 60000 }) => {

  const { message } = App.useApp();
  const t = useI18nTranslateToString();
  const [msgContents, setMsgContents] = useState<RenderContent[]>();
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { dark } = useDarkMode();

  const currentLanguage = useI18n().currentLanguage;

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const { results } = await api.getUnreadMessage({ query: {
          page: 1, pageSize: 10,
        } }).httpError(500, () => {});
        setLoading(false);

        const msgsToRender: RenderContent[] = [];
        for (const msg of results.messages) {
          const renderMsg = renderingMessage(msg, currentLanguage.id);
          if (renderMsg !== undefined) msgsToRender.push(renderMsg);

          if (msgsToRender.length >= 3) break;
        }

        setMsgContents(msgsToRender);
      } catch {
        message.error(t(p("fetchNotifError")));
      }
    };

    fetchNotifications();

    // 定时器，按指定的时间间隔调用
    // const timer = setInterval(() => {
    //   fetchNotifications();
    // }, interval);

    // // 清除定时器
    // return () => clearInterval(timer);
  }, [interval, currentLanguage.id]);

  return (
    <NotifContainer>
      <Card
        style={{ height: "100%", boxShadow: "#0000000D 0px 4px 4px 0px" }}
        loading={loading}
        title={ (
          <>
            <Localized id={p("message")} />
          </>
        )}
        extra={(
          <a
            onClick={() => router.push(`/extensions/${publicConfig.NOTIF_NAME!}/notification`)}
          >
            {t(p("check"))}
          </a>
        )}
      >
        <List
          itemLayout="horizontal"
          locale={{ emptyText: t(p("noMessage")) }}
          dataSource={msgContents}
          renderItem={(item) => (
            <List.Item key={item.id} style={{ borderBottom: "none", padding: "4px 0" }}>
              <List.Item.Meta
                style={{
                  ...dark ? { background: "#282828" } : { background: "#FAFAFA" },
                  borderRadius: "8px", padding: "12px 22px",
                }}
                title={(
                  <div style={{ fontSize: "14px", margin: "0", color: dark ? "#FFFFFF" : "#434343" }}>
                    {item.title}
                  </div>
                )}
                description={(
                  <Text
                    style={{ fontWeight: 350, fontSize: "14px", color: dark ? "#FFFFFF99" : "#43434399" }}
                    ellipsis={true}
                  >{item.description}
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

