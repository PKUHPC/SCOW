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

"use client";

import { useMutation, useQuery } from "@connectrpc/connect-query";
import { ListMessagesRequest } from "@scow/notification-protos/build/message_pb";
import {
  deleteAllReadMessages,
  listMessages,
  markAllMessagesRead,
} from "@scow/notification-protos/build/message-MessageService_connectquery";
import { Button, message } from "antd";
import React, { useContext, useState } from "react";
import { NoShadowButton } from "src/components/no-shadow-button";
import { PageTitle } from "src/components/page-title";
import { ScowParamsContext } from "src/components/scow-params-provider";
import { NoticeType } from "src/models/notice-type";
import { NotificationListTable } from "src/page-components/notification/list-table";
import { getLanguage } from "src/utils/i18n";

export interface PageInfo {
  page: number;
  pageSize: number;
}

const NotificationPage = () => {

  const { scowLangId } = useContext(ScowParamsContext);
  const language = getLanguage(scowLangId);

  const [pageInfo, setPageInfo] = useState<PageInfo>({ page: 1, pageSize: 10 });
  const [query, setQuery] = useState<Partial<ListMessagesRequest>>({
    category: undefined,
  });

  const { data, refetch, isLoading } = useQuery(listMessages, {
    noticeType: NoticeType.SITE_MESSAGE,
    messageTypes: [],
    ...query,
    ...pageInfo,
    $typeName: "notification.ListMessagesRequest",
  });

  const { mutateAsync: markAllRead, isPending: isMarkAllReadPending } = useMutation(markAllMessagesRead, {
    onError: () => message.error(language.notification.markAllReadErrorInfo),
    onSuccess: () => {
      refetch();
      message.success(language.notification.markAllReadSuccessInfo);
    },
  });

  const { mutateAsync: deleteAllRead, isPending: isDeleteAllReadPending } = useMutation(deleteAllReadMessages, {
    onError: () => message.error(language.notification.deleteReadMsgErrorInfo),
    onSuccess: () => {
      refetch();
      message.success(language.notification.deleteReadMsgSuccessInfo);
    },
  });


  const handleMarkAllRead = async () => {
    await markAllRead({});
  };

  const handleDeleteAll = async () => {
    await deleteAllRead({});
  };

  return (
    <div>
      <PageTitle titleText={language.notification.pageTitle}>
        <div style={{ textAlign: "right", marginBottom: "10px" }}>
          <NoShadowButton
            type="primary"
            onClick={handleMarkAllRead}
            loading={isMarkAllReadPending}
            style={{ marginRight: "10px" }}
          >
            {language.notification.markAllRead}
          </NoShadowButton>
          <Button onClick={handleDeleteAll} loading={isDeleteAllReadPending}>
            {language.notification.deleteReadMsg}
          </Button>
        </div>
      </PageTitle>
      <NotificationListTable
        msgData={data}
        isLoading={isLoading}
        refetch={refetch}
        query={query}
        setQuery={setQuery}
        pageInfo={pageInfo}
        setPageInfo={setPageInfo}
        lang={language}
      />
    </div>
  );
};

export default NotificationPage;
