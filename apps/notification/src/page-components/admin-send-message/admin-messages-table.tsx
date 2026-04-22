"use client";

import { timestampDate } from "@bufbuild/protobuf/wkt";
import { useQuery } from "@connectrpc/connect-query";
import { RoundedSearch } from "@scow/lib-web/build/components/styledAntdCom/Input";
import { Message } from "@scow/notification-protos/build/message_pb";
import { adminListMessages } from "@scow/notification-protos/build/message-MessageService_connectquery";
import { Button, Descriptions, Drawer, Form, Table, Tag, Typography } from "antd";
import dayjs from "dayjs";
import React, { useContext, useEffect, useState } from "react";
import { FilterFormContainer } from "src/components/filter-form-container";
import { ScowParamsContext } from "src/components/scow-params-provider";
import { I18nDicType } from "src/models/i18n";
import { getNoticeTypeName } from "src/models/notice-type";
import { formatDateTime } from "src/utils/datetime";
import { getLanguage } from "src/utils/i18n";
import { renderingMessage } from "src/utils/rendering-message";
import { styled } from "styled-components";

const { Text } = Typography;

const SearchWrapper = styled.div`
  width: 400px;
  zoom: 0.85;
`;

interface AdminMessagesTableProps {
  lang: I18nDicType;
  refreshFlag: number;
}

interface MessageDetailDrawerProps {
  visible: boolean;
  onClose: () => void;
  message: Message | undefined;
  lang: I18nDicType;
  language: I18nDicType;
}

interface FilterForm {
  keyword?: string;
}

const MessageDetailDrawer: React.FC<MessageDetailDrawerProps> = ({
  visible, onClose, message, language,
}) => {
  const { scowLangId } = useContext(ScowParamsContext);

  if (!message) return null;

  const content = renderingMessage(message, scowLangId);

  const items = [
    {
      key: "title",
      label: language.sendMessage.adminMessagesTable.title,
      children: content?.title || language.sendMessage.adminMessagesTable.noTitle,
    },
    {
      key: "content",
      label: language.sendMessage.adminMessagesTable.content,
      children: (
        <div style={{ whiteSpace: "pre-wrap" }}>
          {content?.content || language.sendMessage.adminMessagesTable.noContent}
        </div>
      ),
    },
    {
      key: "time",
      label: language.sendMessage.adminMessagesTable.time,
      children: message.createdAt ? formatDateTime(message.createdAt) : language.sendMessage.adminMessagesTable.unknown,
    },
    ...(message.expiredAt ? [{
      key: "expiredAt",
      label: language.sendMessage.adminMessagesTable.expirationTime,
      children: dayjs(timestampDate(message.expiredAt)).format("YYYY-MM-DD HH:mm:ss"),
    }] : []),
    {
      key: "noticeTypes",
      label: language.noticeType.noticeMethod,
      children: message.noticeTypes && message.noticeTypes.length > 0 ? (
        <div>
          {message.noticeTypes.map((noticeType: number, typeIndex: number) => (
            <Tag key={typeIndex} color="blue" style={{ marginRight: "4px", marginBottom: "4px" }}>
              {getNoticeTypeName(noticeType, scowLangId)}
            </Tag>
          ))}
        </div>
      ) : (
        <Tag color="default">{language.noticeType.noNoticeMethod}</Tag>
      ),
    },
  ];

  return (
    <Drawer
      title={language.sendMessage.adminMessagesTable.messageDetails}
      placement="right"
      onClose={onClose}
      open={visible}
      width={600}
    >
      <Descriptions
        column={1}
        items={items}
        labelStyle={{ fontWeight: "bold", width: "120px" }}
        contentStyle={{ wordBreak: "break-word" }}
      />
    </Drawer>
  );
};

export const AdminMessagesTable: React.FC<AdminMessagesTableProps> = ({ lang, refreshFlag }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedMessage, setSelectedMessage] = useState<Message | undefined>(undefined);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [keyword, setKeyword] = useState<string>("");
  const [form] = Form.useForm<FilterForm>();

  const { scowLangId } = useContext(ScowParamsContext);
  const language = getLanguage(scowLangId);

  const { data, isLoading, error, refetch } = useQuery(adminListMessages, {
    page: currentPage,
    pageSize: pageSize,
    keyword,
  });

  useEffect(() => {
    if (refreshFlag > 0) {
      refetch();
    }
  }, [refreshFlag]);

  const handleViewDetail = (message: Message) => {
    setSelectedMessage(message);
    setDrawerVisible(true);
  };

  const handleCloseDrawer = () => {
    setDrawerVisible(false);
    setSelectedMessage(undefined);
  };

  const columns = [
    {
      title: language.sendMessage.adminMessagesTable.serialNumber,
      key: "index",
      width: 80,
      render: (_, __, index: number) => (currentPage - 1) * pageSize + index + 1,
    },
    {
      title: language.sendMessage.adminMessagesTable.time,
      key: "createdAt",
      width: 180,
      render: (_: any, record: Message) => {
        return record.createdAt
          ? formatDateTime(record.createdAt)
          : language.sendMessage.adminMessagesTable.unknown;
      },
    },
    {
      title: language.sendMessage.adminMessagesTable.title,
      key: "title",
      ellipsis: true,
      render: (_: any, record: Message) => {
        const content = renderingMessage(record, scowLangId);
        return content?.title || language.sendMessage.adminMessagesTable.noTitle;
      },
    },
    {
      title: language.sendMessage.adminMessagesTable.messageType,
      key: "messageType",
      width: 300,
      render: (_: any, record: Message) => {
        const template = record.messageType?.titleTemplate;
        return template?.[scowLangId] || template?.default ||
          record.messageType?.type || language.sendMessage.adminMessagesTable.unknown;
      },
    },
    {
      title: language.sendMessage.adminMessagesTable.operation,
      key: "action",
      width: 100,
      render: (_: any, record: Message) => (
        <Button
          type="link"
          size="small"
          onClick={() => handleViewDetail(record)}
        >
          {language.sendMessage.adminMessagesTable.viewDetails}
        </Button>
      ),
    },
  ];

  if (error) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <Text type="danger">{language.sendMessage.adminMessagesTable.loadFailed}: {error.message}</Text>
      </div>
    );
  }

  return (
    <div style={{ marginTop: "40px" }}>
      <div style={{ marginBottom: "16px" }}>
        <Text strong style={{ fontSize: "16px" }}>{language.sendMessage.adminMessagesTable.adminMessages}</Text>
      </div>

      <FilterFormContainer>
        <Form<FilterForm>
          form={form}
          initialValues={{ keyword }}
        >
          <Form.Item name="keyword">
            <SearchWrapper>
              <RoundedSearch
                placeholder={language.sendMessage.adminMessagesTable.keywordPlaceholder}
                onSearch={
                  async () => {
                    const values = await form.validateFields();
                    setKeyword((values.keyword ?? "").trim());
                    setCurrentPage(1);
                  }
                }
                size="large"
                enterButton
              />
            </SearchWrapper>
          </Form.Item>
        </Form>
      </FilterFormContainer>

      <Table
        columns={columns}
        dataSource={data?.messages || []}
        loading={isLoading}
        rowKey={(record) => record.id?.toString() || Math.random().toString()}
        pagination={{
          current: currentPage,
          pageSize: pageSize,
          total: Number(data?.totalCount || 0),
          showSizeChanger: true,
          showQuickJumper: true,
          onChange: (page, size) => {
            setCurrentPage(page);
            setPageSize(size || 10);
          },
        }}
        scroll={{ x: true }}
        locale={{
          emptyText: language.sendMessage.adminMessagesTable.noData,
        }}
      />

      <MessageDetailDrawer
        visible={drawerVisible}
        onClose={handleCloseDrawer}
        message={selectedMessage}
        lang={lang}
        language={language}
      />
    </div>
  );
};
