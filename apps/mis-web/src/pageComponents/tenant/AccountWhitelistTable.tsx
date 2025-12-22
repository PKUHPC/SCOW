import { ExclamationCircleOutlined } from "@ant-design/icons";
import { moneyToNumber } from "@scow/lib-decimal";
import { FilterFormContainer } from "@scow/lib-web/build/components/FilterFormContainer";
import { compareNullableDateTime, compareNullableDateTimeAsMax,
  compareNullableString } from "@scow/lib-web/build/utils/compareNullableValue";
import { formatDateTime } from "@scow/lib-web/build/utils/datetime";
import { DEFAULT_PAGE_SIZE } from "@scow/lib-web/build/utils/pagination";
import { WhitelistedAccount } from "@scow/protos/build/server/account";
import { Static } from "@sinclair/typebox";
import { App, Button, Divider, Form, Input, Space, Table } from "antd";
import { SortOrder } from "antd/lib/table/interface";
import React, { useMemo, useState } from "react";
import { api } from "src/apis";
import { TableTitle } from "src/components/TableTitle";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { Money } from "src/models/UserSchemaModel";
import type {
  GetWhitelistedAccountsSchema } from "src/pages/api/tenant/accountWhitelist/getWhitelistedAccounts";
import { moneyNumberToString, moneyToString } from "src/utils/money";

interface Props {
  data: Static<typeof GetWhitelistedAccountsSchema["responses"]["200"]> | undefined;
  isLoading: boolean;
  reload: () => void;
}

// 过滤表单的结构
interface FilterForm {
  accountName: string | undefined;
  ownerIdOrName: string | undefined;
}

const p = prefix("pageComp.tenant.accountWhitelistTable.");
const pCommon = prefix("common.");

export const AccountWhitelistTable: React.FC<Props> = ({
  data, isLoading, reload,
}) => {

  // 获取国际化翻译函数
  const t = useI18nTranslateToString();

  const { message, modal } = App.useApp();

  const [form] = Form.useForm<FilterForm>();

  // 创建过滤表单
  const [query, setQuery] = useState<FilterForm>({
    accountName: undefined,
    ownerIdOrName: undefined,
  });
  const [currentPageNum, setCurrentPageNum] = useState<number>(1);
  const [currentSortInfo, setCurrentSortInfo] =
    useState<{ field: string | null | undefined, order: SortOrder }>({ field: null, order: null });

  // 对数据进行过滤
  const filteredData = useMemo(() => {

    if (!data) return undefined;

    const filtered = data.results.filter((x) => {
      const dataMatchedAccount =
          !query.accountName || x.accountName.includes(query.accountName);

      const dataMatchedOwner =
          !query.ownerIdOrName || x.ownerId.includes(query.ownerIdOrName) || x.ownerName.includes(query.ownerIdOrName);

      return dataMatchedAccount && dataMatchedOwner;
    });

    return filtered;

  }, [data, query]);

  // 获取欠费总数
  const getTotalDebtAmount =
    (data: Static<typeof GetWhitelistedAccountsSchema["responses"]["200"]> | undefined): number => {
      const sum = data?.results.filter((acct) => !acct.balance?.positive)
        .reduce((acc, acct) => {
          const debtAmount = acct.balance ? moneyToNumber(acct.balance) : 0;
          return acc + debtAmount;
        }, 0);
      return sum ? Math.abs(sum) : 0;
    };

  // 处理表格变化事件
  const handleTableChange = (_, __, sortInfo) => {
    setCurrentSortInfo({ field: sortInfo.field, order: sortInfo.order });
  };

  return (
    <div>
      <FilterFormContainer>
        <Form<FilterForm>
          layout="inline"
          form={form}
          initialValues={query}
          onFinish={async () => {
            setQuery(await form.validateFields());
            setCurrentPageNum(1);
            setCurrentSortInfo({ field: null, order: null });
          }}
        >
          <Form.Item label={t(pCommon("account"))} name="accountName">
            <Input />
          </Form.Item>
          <Form.Item label={t(p("ownerIdOrName"))} name="ownerIdOrName">
            <Input />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">{t(pCommon("search"))}</Button>
          </Form.Item>
        </Form>
      </FilterFormContainer>
      <>
        {/* 名单表格 */}
        <TableTitle justify="flex-start">
          {
            data ? (
              <div>
                <span>
                  {t(p("whiteList"))}：<span>{data.results.length ?? 0}</span>
                </span>
                <>
                  <Divider type="vertical" />
                  <span>
                    {t(p("debtSum"))}：<span>{
                      moneyNumberToString(getTotalDebtAmount(data))} {t(pCommon("unit"))}</span>
                  </span>
                </>
              </div>
            ) : undefined
          }
        </TableTitle>
        <Table
          dataSource={filteredData}
          loading={isLoading}
          rowKey="accountName"
          scroll={{ x: true }}
          pagination={{
            showSizeChanger: true,
            defaultPageSize: DEFAULT_PAGE_SIZE,
            current: currentPageNum,
            onChange: (page) => setCurrentPageNum(page),
          }}
          onChange={handleTableChange}
        >
          <Table.Column<WhitelistedAccount>
            dataIndex="accountName"
            title={t(pCommon("account"))}
            sorter={(a, b) => a.accountName.localeCompare(b.accountName)}
            sortDirections={["ascend", "descend"]}
            sortOrder={currentSortInfo.field === "accountName" ? currentSortInfo.order : null}
          />
          <Table.Column<WhitelistedAccount>
            dataIndex="ownerId"
            title={t(pCommon("owner"))}
            render={(_, r) => `${r.ownerName} (ID: ${r.ownerId})`}
            sorter={(a, b) => compareNullableString(a.ownerName, b.ownerName)}
            sortDirections={["ascend", "descend"]}
            sortOrder={currentSortInfo.field === "ownerId" ? currentSortInfo.order : null}
          />
          <Table.Column<WhitelistedAccount>
            dataIndex="balance"
            title={t(pCommon("balance"))}
            sorter={(a, b) => (a.balance ? moneyToNumber(a.balance) : 0) - (b.balance ? moneyToNumber(b.balance) : 0)}
            sortDirections={["ascend", "descend"]}
            sortOrder={currentSortInfo.field === "balance" ? currentSortInfo.order : null}
            render={(b: Money) => moneyToString(b) + " " + t(pCommon("unit")) }
          />
          <Table.Column<WhitelistedAccount>
            dataIndex="addTime"
            title={t(p("joinTime"))}
            render={(time: string) => formatDateTime(time) }
            sorter={(a, b) => compareNullableDateTime(a.addTime, b.addTime)}
            sortDirections={["ascend", "descend"]}
            sortOrder={currentSortInfo.field === "addTime" ? currentSortInfo.order : null}
          />
          <Table.Column<WhitelistedAccount>
            dataIndex="expirationTime"
            title={t(p("expirationTime"))}
            render={(time: string | undefined) => time ? formatDateTime(time) : "永久有效"}
            sorter={(a, b) => compareNullableDateTimeAsMax(a.expirationTime, b.expirationTime)}
            sortDirections={["ascend", "descend"]}
            sortOrder={currentSortInfo.field === "expirationTime" ? currentSortInfo.order : null}
          />
          <Table.Column<WhitelistedAccount>
            dataIndex="comment"
            title={t(pCommon("comment"))}
            sorter={(a, b) => compareNullableString(a.comment, b.comment)}
            sortDirections={["ascend", "descend"]}
            sortOrder={currentSortInfo.field === "comment" ? currentSortInfo.order : null}
          />
          <Table.Column<WhitelistedAccount>
            dataIndex="operatorId"
            title={t(p("operatorId"))}
            sorter={(a, b) => compareNullableString(a.operatorId, b.operatorId)}
            sortDirections={["ascend", "descend"]}
            sortOrder={currentSortInfo.field === "operatorId" ? currentSortInfo.order : null}

          />
          <Table.Column<WhitelistedAccount>
            title={t(pCommon("operation"))}
            render={(_, r) => (
              <Space split={<Divider type="vertical" />}>
                <a onClick={() => {
                  modal.confirm({
                    title: t(p("confirmRemoveWhite")),
                    icon: <ExclamationCircleOutlined />,
                    content: `${t(p("confirmRemoveWhiteText1"))}${r.accountName}${t(p("confirmRemoveWhiteText2"))}`,
                    onOk: async () => {
                      await api.dewhitelistAccount({ query: {
                        accountName: r.accountName,
                      } })
                        .httpError(409, () => {
                          message.error(t("common.accountUserSyncRunning"));
                        })
                        .then(() => {
                          message.success(t(p("removeWhiteSuccess")));
                          reload();
                        });
                    },
                  });
                }}
                >
                  {t(p("removeWhite"))}
                </a>
              </Space>
            )}
          />
        </Table>
      </>
    </div>
  );
};
