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

import { ExclamationCircleOutlined } from "@ant-design/icons";
import { moneyToNumber } from "@scow/lib-decimal";
import { DEFAULT_PAGE_SIZE } from "@scow/lib-web/build/utils/pagination";
import { Money } from "@scow/protos/build/common/money";
import { Static } from "@sinclair/typebox";
import { App, Button, Divider, Form, Input, Popover, Space, Table, Tag, Tooltip } from "antd";
import { SortOrder } from "antd/es/table/interface";
import Link from "next/link";
import React, { useMemo, useState } from "react";
import { api } from "src/apis";
import { DeleteEntityFailedModal } from "src/components/DeleteEntityFailedModal";
import { DeleteEntityModalLink } from "src/components/DeleteEntityModal";
import { DisabledA } from "src/components/DisabledA";
import { FilterFormContainer, FilterFormTabs } from "src/components/FilterFormContainer";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { Encoding } from "src/models/exportFile";
import { AccountState, DisplayedAccountState, getDisplayedStateI18nTexts } from "src/models/User";
import { DeleteFailedReason,EntityType } from "src/models/User";
import { ExportFileModaLButton } from "src/pageComponents/common/exportFileModal";
import { MAX_EXPORT_COUNT, urlToExport } from "src/pageComponents/file/apis";
import type { AdminAccountInfo, GetAccountsSchema } from "src/pages/api/tenant/getAccounts";
import { moneyToString } from "src/utils/money";

import { SetBlockThresholdAmountLink } from "./SetBlockThresholdAmountModal";

type ShowedTab = "PLATFORM" | "TENANT";
interface Props {
  data: Static<typeof GetAccountsSchema["responses"]["200"]> | undefined;
  isLoading: boolean;
  reload: () => void;
  showedTab: ShowedTab;
}

interface FilterForm {
  accountName: string | undefined;
  ownerIdOrName: string | undefined;
}

const FilteredTypes = {
  ALL: "ALL",
  DISPLAYED_NORMAL: DisplayedAccountState.DISPLAYED_NORMAL,
  DISPLAYED_FROZEN: DisplayedAccountState.DISPLAYED_FROZEN,
  DISPLAYED_BLOCKED: DisplayedAccountState.DISPLAYED_BLOCKED,
  DISPLAYED_BELOW_BLOCK_THRESHOLD: DisplayedAccountState.DISPLAYED_BELOW_BLOCK_THRESHOLD,
  DISPLAYED_DELETED: DisplayedAccountState.DISPLAYED_DELETED,
};

const filteredStatuses = {
  "ALL": "pageComp.accounts.accountTable.allAccount",
  "DISPLAYED_NORMAL": "pageComp.accounts.accountTable.normalAccount",
  "DISPLAYED_FROZEN": "pageComp.accounts.accountTable.frozenAccount",
  "DISPLAYED_BLOCKED": "pageComp.accounts.accountTable.blockedAccount",
  "DISPLAYED_BELOW_BLOCK_THRESHOLD": "pageComp.accounts.accountTable.debtAccount",
  "DISPLAYED_DELETED": "pageComp.accounts.accountTable.deletedAccount",
};
type FilteredStatus = keyof typeof filteredStatuses;

const p = prefix("pageComp.accounts.accountTable.");
const pCommon = prefix("common.");
const pDelete = prefix("component.deleteModals.");

export const AccountTable: React.FC<Props> = ({
  data, isLoading, showedTab, reload,
}) => {

  const { message, modal } = App.useApp();
  const [form] = Form.useForm<FilterForm>();

  const t = useI18nTranslateToString();

  const DisplayedStateI18nTexts = getDisplayedStateI18nTexts(t);

  const [rangeSearchStatus, setRangeSearchStatus] = useState<FilteredStatus>("ALL");
  const [currentPageNum, setCurrentPageNum] = useState<number>(1);
  const [currentSortInfo, setCurrentSortInfo] =
    useState<{ field: string | null | undefined, order: SortOrder }>({ field: null, order: null });

  const [query, setQuery] = useState<FilterForm>({
    accountName: undefined,
    ownerIdOrName: undefined,
  });

  const filteredData = useMemo(() => {

    if (!data) return undefined;

    const filtered = data.results.filter((x) => {
      const dataMatchedAccount =
        !query.accountName || x.accountName.includes(query.accountName);

      const dataMatchedOwner =
        !query.ownerIdOrName || x.ownerId.includes(query.ownerIdOrName) || x.ownerName.includes(query.ownerIdOrName);

      const dataMatchedState =
        rangeSearchStatus === FilteredTypes.ALL ||
        (rangeSearchStatus !== FilteredTypes.ALL &&
          x.displayedState === FilteredTypes[rangeSearchStatus]);

      return dataMatchedAccount && dataMatchedOwner && dataMatchedState;
    });

    return filtered;

  }, [data, query, rangeSearchStatus]);

  const searchData = useMemo(() => data ? data.results.filter((x) => (
    (!query.accountName || x.accountName.includes(query.accountName))
    && (!query.ownerIdOrName || x.ownerId.includes(query.ownerIdOrName) || x.ownerName.includes(query.ownerIdOrName))
  )) : undefined, [data, query]);

  const accountStatusCount = useMemo(() => {
    if (!searchData) return {
      DISPLAYED_BLOCKED: 0,
      DISPLAYED_FROZEN: 0,
      DISPLAYED_BELOW_BLOCK_THRESHOLD: 0,
      DISPLAYED_NORMAL: 0,
      DISPLAYED_DELETED: 0,
      ALL: 0,
    };
    const counts = {
      DISPLAYED_FROZEN: searchData.filter((account) =>
        account.displayedState === DisplayedAccountState.DISPLAYED_FROZEN).length,
      DISPLAYED_BLOCKED: searchData.filter((account) =>
        account.displayedState === DisplayedAccountState.DISPLAYED_BLOCKED).length,
      DISPLAYED_BELOW_BLOCK_THRESHOLD: searchData.filter((account) =>
        account.displayedState === DisplayedAccountState.DISPLAYED_BELOW_BLOCK_THRESHOLD).length,
      DISPLAYED_NORMAL: searchData.filter((account) =>
        account.displayedState === DisplayedAccountState.DISPLAYED_NORMAL).length,
      DISPLAYED_DELETED: searchData.filter((account) =>
        account.displayedState === DisplayedAccountState.DISPLAYED_DELETED).length,
      ALL: searchData.length,
    };
    return counts;
  }, [searchData]);

  const handleTableChange = (_, __, sortInfo) => {
    setCurrentSortInfo({ field: sortInfo.field, order: sortInfo.order });
  };

  const handleFilterStatusChange = (status: FilteredStatus) => {
    setRangeSearchStatus(status);
    setCurrentPageNum(1);
    setCurrentSortInfo({ field: null, order: null });
  };

  const handleExport = async (columns: string[], encoding: Encoding) => {

    const total = filteredData?.length || 0;

    if (total > MAX_EXPORT_COUNT) {
      message.error(t(pCommon("exportMaxDataErrorMsg"), [MAX_EXPORT_COUNT]));
    } else if (total <= 0) {
      message.error(t(pCommon("exportNoDataErrorMsg")));
    } else {

      window.location.href = urlToExport({
        exportApi: "exportAccount",
        columns,
        count: total,
        encoding,
        query: {
          accountName: query.accountName,
          blocked: rangeSearchStatus === "DISPLAYED_BLOCKED",
          debt: rangeSearchStatus === "DISPLAYED_BELOW_BLOCK_THRESHOLD",
          frozen: rangeSearchStatus === "DISPLAYED_FROZEN",
          normal: rangeSearchStatus === "DISPLAYED_NORMAL",
          deleted: rangeSearchStatus === "DISPLAYED_DELETED",
          isFromAdmin: showedTab === "PLATFORM",
          ownerIdOrName: query.ownerIdOrName,
        },
      });
    }
  };

  const exportOptions = useMemo(() => {
    const common = [
      { label: t(p("accountName")), value: "accountName" },
      { label: t(p("owner")), value: "owner" },
      { label: t(pCommon("userCount")), value: "userCount" },
    ];

    const tenant = showedTab === "PLATFORM" ? [
      { label: t(p("tenant")), value: "tenantName" },
    ] : [];
    const remaining = [
      { label: t(pCommon("balance")), value: "balance" },
      { label: t(p("blockThresholdAmount")), value: "blockThresholdAmount" },
      { label: t(p("status")), value: "displayedState" },
      { label: t(p("comment")), value: "comment" },
    ];
    return [...common, ...tenant, ...remaining];
  }, [showedTab, t]);

  const [failedModalVisible, setFailedModalVisible] = useState(false);
  const [failedDeletedMessage, setFailedDeletedMessage] = useState({
    type: DeleteFailedReason.RUNNING_JOBS,
  });

  return (
    <div>
      <FilterFormContainer style={{ display: "flex", justifyContent: "space-between" }}>
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
          <Form.Item label={t(p("account"))} name="accountName">
            <Input />
          </Form.Item>
          <Form.Item label={t(p("ownerIdOrName"))} name="ownerIdOrName">
            <Input />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">{t(pCommon("search"))}</Button>
          </Form.Item>
          <Form.Item>
            <ExportFileModaLButton
              options={exportOptions}
              onExport={handleExport}
            >
              {t(pCommon("export"))}
            </ExportFileModaLButton>
          </Form.Item>
        </Form>
        <Space style={{ marginBottom: "-16px" }}>
          <FilterFormTabs
            tabs={Object.keys(filteredStatuses)
              /** 以下为暂时过滤掉冻结状态的页面展示 */
              .filter((status) => status !== "DISPLAYED_FROZEN")
              /** 以上为暂时过滤掉冻结状态的页面展示 */
              .map((status) => ({
                title: `${t(filteredStatuses[status])}(${accountStatusCount[status as FilteredStatus]})`,
                key: status,
              }))}
            onChange={(value) => handleFilterStatusChange(value as FilteredStatus)}
          />
        </Space>
      </FilterFormContainer>

      <Table
        tableLayout="fixed"
        dataSource={filteredData}
        loading={isLoading}
        pagination={{
          showSizeChanger: true,
          defaultPageSize: DEFAULT_PAGE_SIZE,
          current: currentPageNum,
          onChange: (page) => setCurrentPageNum(page),
        }}
        rowKey="userId"
        scroll={{ x: filteredData?.length ? 1200 : true }}
        onChange={handleTableChange}
      >
        <Table.Column<AdminAccountInfo>
          dataIndex="accountName"
          title={t(p("accountName"))}
          sorter={(a, b) => a.accountName.localeCompare(b.accountName)}
          sortDirections={["ascend", "descend"]}
          sortOrder={currentSortInfo.field === "accountName" ? currentSortInfo.order : null}
        />
        <Table.Column<AdminAccountInfo>
          dataIndex="ownerName"
          width="20%"
          title={t(p("owner"))}
          render={(_, r) => `${r.ownerName}（ID: ${r.ownerId}）`}
        />
        <Table.Column<AdminAccountInfo>
          dataIndex="userCount"
          width="8%"
          title={t(pCommon("userCount"))}
        />
        {/* 只在平台管理下的账户列表中显示 */}
        {showedTab === "PLATFORM" && (
          <Table.Column<AdminAccountInfo>
            dataIndex="tenantName"
            width="10%"
            title={t(p("tenant"))}
          />
        )}
        <Table.Column<AdminAccountInfo>
          dataIndex="balance"
          width="13%"
          title={t(pCommon("balance"))}
          sorter={(a, b) => (moneyToNumber(a.balance)) - (moneyToNumber(b.balance))}
          sortDirections={["ascend", "descend"]}
          sortOrder={currentSortInfo.field === "balance" ? currentSortInfo.order : null}
          render={(b: Money) => moneyToString(b) + t(p("unit"))}
        />
        <Table.Column<AdminAccountInfo>
          dataIndex="blockThresholdAmount"
          title={(
            <Space>
              {t(pCommon("blockThresholdAmount"))}
              <Tooltip title={t(p("blockThresholdAmountTooltip"))}>
                <ExclamationCircleOutlined />
              </Tooltip>
            </Space>
          )}
          render={(_, r) => `${moneyToString(r.blockThresholdAmount ?? r.defaultBlockThresholdAmount)} ${t(p("unit"))}`}
        />
        <Table.Column<AdminAccountInfo>
          dataIndex="displayedState"
          width="7%"
          title={(
            <Space>
              {t(p("status"))}
              <Popover
                title={t(p("statusTooltip"))}
                content={(
                  <>
                    {/* 以下为暂时过滤掉冻结状态的页面展示，描述需要后期再次确认修改 */}
                    {/* <span>{t(p("statusFrozenTooltip"))}</span>
                    <br /> */}
                    {/* 以上为暂时过滤掉冻结状态的页面展示，描述需要后期再次确认修改 */}
                    <span>{t(p("statusBlockedTooltip"))}</span>
                    <br />
                    <span>{t(p("statusDebtTooltip"))}</span>
                    <br />
                    <span>{t(p("statusNormalTooltip"))}</span>
                  </>
                )}
              >
                <ExclamationCircleOutlined />
              </Popover>
            </Space>
          )}
          render={(s) => {
            return (
              <Tag color={s === DisplayedAccountState.DISPLAYED_NORMAL ? "green" : "red"}>
                {DisplayedStateI18nTexts[s]}
              </Tag>
            );
          }
          }
        />
        <Table.Column<AdminAccountInfo>
          dataIndex="comment"
          ellipsis
          title={t(p("comment"))}
        />
        <Table.Column<AdminAccountInfo>
          title={t(pCommon("operation"))}
          width="15%"
          fixed="right"
          render={(_, r) => (
            <Space split={<Divider type="vertical" />}>
              {/* 只在租户管理下的账户列表中显示管理成员和封锁阈值 */}
              {showedTab === "TENANT" && (r.state !== AccountState.DELETED ? (
                <>
                  <Link href={{ pathname: `/tenant/accounts/${r.accountName}/users` }}>
                    {t(p("mangerMember"))}
                  </Link>
                  <SetBlockThresholdAmountLink
                    accountName={r.accountName}
                    balance={r.balance}
                    reload={reload}
                    currentAmount={r.blockThresholdAmount}
                    defaultBlockThresholdAmount={r.defaultBlockThresholdAmount}
                  >
                    {t(p("blockThresholdAmount"))}
                  </SetBlockThresholdAmountLink>
                </>
              ) : (
                <>
                  <DisabledA message={t(pDelete("accountDeleted"))} disabled={true}>
                    {t(p("mangerMember"))}
                  </DisabledA>
                  <DisabledA message={t(pDelete("accountDeleted"))} disabled={true}>
                    {t(p("blockThresholdAmount"))}
                  </DisabledA>
                </>
              )
              )}
              {
                r.state === AccountState.BLOCKED_BY_ADMIN && (
                  <a onClick={() => {
                    modal.confirm({
                      title: t(p("unblockConfirmTitle")),
                      icon: <ExclamationCircleOutlined />,
                      content: t(p("unblockConfirmContent"), [r.tenantName, r.accountName]),
                      onOk: async () => {
                        await api.unblockAccount({
                          body: {
                            tenantName: r.tenantName,
                            accountName: r.accountName,
                          },
                        })
                          .then((res) => {
                            if (res.executed) {
                              message.success(t(p("unblockSuccess")));
                              reload();
                            } else {
                              message.error(res.reason || t(p("unblockFail")));
                            }
                          });
                      },
                    });

                  }}
                  >
                    {t(p("unblock"))}
                  </a>
                )}
              {
                !r.isInWhitelist && (r.state === AccountState.NORMAL || r.state === AccountState.FROZEN) && (
                  <a onClick={() => {
                    modal.confirm({
                      title: t(p("blockConfirmTitle")),
                      icon: <ExclamationCircleOutlined />,
                      content: t(p("blockConfirmContent"), [r.tenantName, r.accountName]),
                      onOk: async () => {
                        await api.blockAccount({
                          body: {
                            tenantName: r.tenantName,
                            accountName: r.accountName,
                          },
                        })
                          .then((res) => {
                            if (res.executed) {
                              message.success(t(p("blockSuccess")));
                              reload();
                            } else {
                              message.error(res.reason || t(p("blockFail")));
                            }
                          });
                      },
                    });
                  }}
                  >
                    {t(p("block"))}
                  </a>
                )}
              {showedTab === "TENANT" && (
                r.state === AccountState.DELETED ? (
                  <DisabledA message={t(pDelete("accountDeleted"))} disabled={true}>
                    {t(p("delete"))}
                  </DisabledA>
                ) : (
                  <DeleteEntityModalLink
                    id={r.ownerId}
                    name={r.accountName}
                    type="ACCOUNT"
                    onComplete={async (inputUserId, inputAccountName, comment) => {

                      message.open({
                        type: "loading",
                        content: t("common.waitingMessage"),
                        duration: 0,
                        key: "deleteAccount" });

                      await api.deleteAccount({ query: {
                        ownerId:inputUserId,
                        accountName:inputAccountName,
                        comment: comment,
                      } })// 待完善
                        .httpError(404, (e) => {
                          message.destroy("deleteAccount");
                          message.error({
                            content: e.message,
                            duration: 4,
                          });
                        })
                        .httpError(409, (e) => {
                          message.destroy("deleteAccount");
                          const { type } = JSON.parse(e.message);
                          setFailedModalVisible(true);
                          setFailedDeletedMessage({ type });
                          reload();
                        })
                        .then(() => {
                          message.destroy("deleteAccount");
                          reload();
                        })
                        .catch(() => { message.error(t(p("changeFail"))); });
                    }}
                  >
                    {t(p("delete"))}
                  </DeleteEntityModalLink>
                )
              )}
            </Space>
          )}
        />
      </Table>
      <DeleteEntityFailedModal
        message={failedDeletedMessage}
        open={failedModalVisible}
        entityType={EntityType.ACCOUNT}
        onClose={() => {
          setFailedModalVisible(false);
        }}
      >
      </DeleteEntityFailedModal>
    </div>
  );
};
