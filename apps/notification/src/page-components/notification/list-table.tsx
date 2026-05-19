import { ConnectError } from "@connectrpc/connect";
import { useMutation } from "@connectrpc/connect-query";
import { deleteMessages } from "@scow/notification-protos/build/message-MessageService_connectquery";
import { ListMessagesRequest, ListMessagesResponse } from "@scow/notification-protos/build/message_pb";
import { QueryObserverResult, RefetchOptions } from "@tanstack/react-query";
import { message, Tabs } from "antd";
import React, { Dispatch, SetStateAction, useMemo, useState } from "react";
import { PageInfo } from "src/app/extensions/(user)/notification/page";
import { I18nDicType } from "src/models/i18n";
import { NotificationList } from "src/page-components/notification/list";
import { styled } from "styled-components";

const TabsContainer = styled.div`
  font-size: 16px;
  padding: 20px;
  background: ${({ theme }) => {
    return theme.token.colorBgElevated;
  }};
  border-radius: ${({ theme }) => theme.token.borderRadius}px;
`;

const CustomTabs = styled(Tabs)`
  .ant-tabs-tab {
    font-size: 16px; /* 在这里调整字体大小 */
  }
`;

interface TabItem {
  title: string;
  key: string;
}

enum TabItemKey {
  ALL = "All",
  ADMIN = "Admin",
  ACCOUNT = "Account",
  JOB = "Job",
}

interface Props {
  msgData: ListMessagesResponse | undefined;
  refetch: (options?: RefetchOptions) => Promise<QueryObserverResult<ListMessagesResponse, ConnectError>>;
  isLoading: boolean;
  query: Partial<ListMessagesRequest>;
  setQuery: Dispatch<SetStateAction<Partial<ListMessagesRequest>>>;
  pageInfo: PageInfo;
  setPageInfo: Dispatch<SetStateAction<PageInfo>>;
  lang: I18nDicType;
}

export const NotificationListTable: React.FC<Props> = ({
  msgData,
  refetch,
  isLoading,
  query,
  setQuery,
  pageInfo,
  setPageInfo,
  lang,
}) => {
  const [activeKey, setActiveKey] = useState(TabItemKey.ALL);
  const compLang = lang.notification.listTable;

  const tabItems: TabItem[] = [
    { title: compLang.all, key: TabItemKey.ALL },
    { title: compLang.systemNotif, key: TabItemKey.ADMIN },
    { title: compLang.accountNotif, key: TabItemKey.ACCOUNT },
    { title: compLang.jobNotif, key: TabItemKey.JOB },
  ];

  const { mutateAsync: deleteMsgs } = useMutation(deleteMessages, {
    onError: () => message.error(compLang.deleteError),
    onSuccess: () => {
      refetch();
      message.success(compLang.deleteSuccess);
    },
  });

  const handleDelete = async (id: bigint) => {
    await deleteMsgs({ messageIds: [id] });
    refetch();
  };

  const items = useMemo(
    () =>
      tabItems.map((item) => {
        return {
          label: item.title,
          key: item.key,
          children: (
            <NotificationList
              totalCount={Number(msgData?.totalCount)}
              messageList={msgData?.messages ?? []}
              pageInfo={pageInfo}
              isLoading={isLoading}
              setPageInfo={setPageInfo}
              handleDelete={handleDelete}
              refetch={refetch}
              lang={lang}
            />
          ),
        };
      }),
    [tabItems, msgData, pageInfo],
  );

  const handleTabChange = (key) => {
    setActiveKey(key);
    setPageInfo({ ...pageInfo, page: 1 });
    setQuery({
      ...query,
      category: key === TabItemKey.ALL ? undefined : key,
    });
  };

  return (
    <TabsContainer>
      <CustomTabs activeKey={activeKey} onChange={handleTabChange} items={items}></CustomTabs>
    </TabsContainer>
  );
};
