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

import { ConnectError } from "@connectrpc/connect";
import { useMutation } from "@connectrpc/connect-query";
import { ListMessagesResponse, Message } from "@scow/notification-protos/build/message_pb";
import { markMessageRead } from "@scow/notification-protos/build/message-MessageService_connectquery";
import { QueryObserverResult, RefetchOptions } from "@tanstack/react-query";
import { App, List, PaginationProps, Typography } from "antd";
import { join } from "path";
import React, { useContext, useState } from "react";
import { PageInfo } from "src/app/extensions/(user)/notification/page";
import { DeleteIcon } from "src/assets/icons/operationIcon";
import { ScowParamsContext } from "src/components/scow-params-provider";
import { I18nDicType } from "src/models/i18n";
import { RenderContent, renderingMessage } from "src/utils/rendering-message";
import { styled } from "styled-components";

import { MessageContentModal } from "./message-content-modal";

const { Text } = Typography;

// 定义 props 类型
interface StyledListItemProps {
  isDark: boolean;
  isRead: boolean;
  index: number;
}


// 直接使用类型定义来避免错误
const StyledListItem = styled(List.Item)<StyledListItemProps>`
  height: 60px;
  cursor: pointer;
  background: ${({ isRead, isDark, index }) =>
    isDark
      ? isRead ? (index % 2 === 0 ? "#121212" : "#1D1D1D") : "#172D3B"
      : isRead ? (index % 2 === 0 ? "white" : "#F7F7F7") : "#F2FAFF"};

  &:hover {
    background: ${({ isDark }) => isDark ? "#1D262C" : "#E9EDEE"};
  }
`;

const ItemContainer = styled.div`
  width: 100%;
  display: flex;
  align-items: center;
  white-space: nowrap;
  justify-content: space-between;
`;

const StatusContainer = styled.div`
  font-size: 12px;
  width: 80px;
  margin: 0 20px 0 15px;
  display: flex;
  align-items: center;
  flex-shrink: 0;

  img {
    margin-right: 4px;
  }
`;

const ContentContainer = styled.div`
  font-size: 14px;
  margin-right: 40px;
  width: 70%;
  display: flex;
  justify-self: start;
  align-items: center;
  flex-grow: 1;
  overflow: hidden;
`;

const ActionsContainer = styled.div`
  font-size: 14px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  margin: 0 15px 0 20px;

  img {
    margin-left: 10px;
    cursor: pointer;
  }
`;

interface Props {
  totalCount: number;
  messageList: Message[];
  pageInfo: PageInfo,
  isLoading: boolean;
  setPageInfo: React.Dispatch<React.SetStateAction<PageInfo>>
  handleDelete: (id: bigint) => Promise<void>;
  refetch: (options?: RefetchOptions) => Promise<QueryObserverResult<ListMessagesResponse, ConnectError>>;
  lang: I18nDicType;
}
export const NotificationList: React.FC<Props> = ({
  totalCount, messageList, pageInfo, isLoading, setPageInfo, handleDelete, refetch, lang,
}) => {

  const [modalOpen, setModalOpen] = useState(false);
  const [readMsg, setReadMsg] = useState<RenderContent>();
  const compLang = lang.notification.list;

  const { mutateAsync: markRead } = useMutation(markMessageRead, {
    onSuccess: () => refetch(),
  });

  const { modal } = App.useApp();
  const { scowLangId, scowDark: isDark, basePath } = useContext(ScowParamsContext);

  const onPageChange: PaginationProps["onChange"] = (page, pageSize) => {
    setPageInfo({ page, pageSize });
  };

  const openModal = (msg: RenderContent) => {
    setModalOpen(true);
    setReadMsg(msg);
    markRead({ messageId: msg.id });
  };

  return (
    <>
      <List
        pagination={{
          position: "bottom",
          align: "end",
          total: totalCount,
          pageSize: pageInfo.pageSize,
          onChange: onPageChange,
          current: pageInfo.page,
        }}
        loading={isLoading}
        dataSource={messageList}
        renderItem={(item, index) => {
          const renderingContent = renderingMessage(item, String(scowLangId));
          return renderingContent ? (
            <StyledListItem
              onClick={() => openModal(renderingContent)}
              isRead={item.isRead ?? false}
              isDark={isDark}
              index={index}
            >
              <ItemContainer>
                <StatusContainer>
                  <img
                    height={15}
                    width={20}
                    src={item.isRead ? join(basePath, "/icons/gray-mail.svg") : join(basePath, "/icons/mail.svg") }
                  />
                  <span>{item.isRead ? compLang.read : compLang.unread}</span>
                </StatusContainer>
                <ContentContainer>
                  <div>【{renderingContent.title}】</div>
                  <Text ellipsis>
                    {renderingContent.content}
                  </Text>
                </ContentContainer>
                <ActionsContainer>
                  <div>{renderingContent.createdAt}</div>
                  <DeleteIcon
                    onClick={(e) => {
                      e.stopPropagation();
                      modal.confirm({
                        title: compLang.deleteConfirmTitle,
                        content: compLang.deleteConfirmContent,
                        onOk: () => handleDelete(item.id),
                      });
                    }}
                  />
                </ActionsContainer>
              </ItemContainer>
            </StyledListItem>
          ) : undefined;
        }}
      />
      <MessageContentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        data={readMsg}
      ></MessageContentModal>
    </>
  );
};
