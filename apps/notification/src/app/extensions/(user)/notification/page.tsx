"use client";

import { useMutation, useQuery } from "@connectrpc/connect-query";
import {
  deleteAllReadMessages,
  listMessages,
  markAllMessagesRead,
} from "@scow/notification-protos/build/message-MessageService_connectquery";
import { ListMessagesRequest } from "@scow/notification-protos/build/message_pb";
import { App } from "antd";
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
  const { message, modal } = App.useApp();
  const lang = language.notification;

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
    onError: () => message.error(lang.markAllReadErrorInfo),
    onSuccess: () => {
      refetch();
      message.success(lang.markAllReadSuccessInfo);
    },
  });

  const { mutateAsync: deleteAllRead, isPending: isDeleteAllReadPending } = useMutation(deleteAllReadMessages, {
    onError: () => message.error(lang.deleteReadMsgErrorInfo),
    onSuccess: () => {
      refetch();
      message.success(lang.deleteReadMsgSuccessInfo);
    },
  });

  const handleMarkAllRead = () => {
    modal.confirm({
      title: lang.markAllReadConfirmTitle,
      content: lang.markAllReadConfirmContent,
      onOk: () => markAllRead({}),
    });
  };

  const handleDeleteAll = () => {
    modal.confirm({
      title: lang.deleteReadMsgConfirmTitle,
      content: lang.deleteReadMsgConfirmContent,
      onOk: () => deleteAllRead({}),
    });
  };

  return (
    <div>
      <PageTitle titleText={lang.pageTitle}>
        <div style={{ textAlign: "right", marginBottom: "10px" }}>
          <NoShadowButton
            type="primary"
            onClick={handleMarkAllRead}
            loading={isMarkAllReadPending}
            style={{ marginRight: "10px" }}
          >
            {lang.markAllRead}
          </NoShadowButton>
          <NoShadowButton type="primary" onClick={handleDeleteAll} loading={isDeleteAllReadPending}>
            {lang.deleteReadMsg}
          </NoShadowButton>
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
