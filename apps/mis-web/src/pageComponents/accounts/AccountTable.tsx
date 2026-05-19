import type { AdminAccountInfo, GetAccountsSchema } from "src/pages/api/tenant/getAccounts";

import { ExclamationCircleOutlined } from "@ant-design/icons";
import { moneyToNumber } from "@scow/lib-decimal";
import { TrimInput as Input } from "@scow/lib-web/build/components/styledAntdCom/TrimInput";
import { compareNullableNumber, compareNullableString } from "@scow/lib-web/build/utils/compareNullableValue";
import { DEFAULT_PAGE_SIZE } from "@scow/lib-web/build/utils/pagination";
import { Money } from "@scow/protos/build/common/money";
import { Static } from "@sinclair/typebox";
import { App, Button, Divider, Form, Popover, Space, Table, Tag, Tooltip } from "antd";
import { SortOrder } from "antd/es/table/interface";
import Link from "next/link";
import React, { useMemo, useState } from "react";
import { useStore } from "simstate";
import { api } from "src/apis";
import { DeleteEntityFailedModal } from "src/components/DeleteEntityFailedModal";
import { DeleteEntityModalLink } from "src/components/DeleteEntityModal";
import { DisabledA } from "src/components/DisabledA";
import { FilterFormContainer, FilterFormTabs } from "src/components/FilterFormContainer";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { Encoding } from "src/models/exportFile";
import { AccountState, DeleteFailedReason, DisplayedAccountState, EntityType, getDisplayedStateI18nTexts } from "src/models/User";
import { ExportFileModaLButton } from "src/pageComponents/common/exportFileModal";
import { MAX_EXPORT_COUNT, urlToExport } from "src/pageComponents/file/apis";
import { UserStore } from "src/stores/UserStore";
import { publicConfig } from "src/utils/config";
import { moneyToString } from "src/utils/money";

import { SetBlockThresholdAmountLink } from "./SetBlockThresholdAmountModal";

type ShowedTab = "PLATFORM" | "TENANT";
interface Props {
  data: Static<(typeof GetAccountsSchema)["responses"]["200"]> | undefined;
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
  ALL: "pageComp.accounts.accountTable.allAccount",
  DISPLAYED_NORMAL: "pageComp.accounts.accountTable.normalAccount",
  DISPLAYED_FROZEN: "pageComp.accounts.accountTable.frozenAccount",
  DISPLAYED_BLOCKED: "pageComp.accounts.accountTable.blockedAccount",
  DISPLAYED_BELOW_BLOCK_THRESHOLD: "pageComp.accounts.accountTable.debtAccount",
  DISPLAYED_DELETED: "pageComp.accounts.accountTable.deletedAccount",
};
type FilteredStatus = keyof typeof filteredStatuses;

const p = prefix("pageComp.accounts.accountTable.");
const pCommon = prefix("common.");
const pDelete = prefix("component.deleteModals.");

const deleteEnabled = publicConfig.DELETE_ACCOUNT_CONFIG?.enabled ?? false;

export const AccountTable: React.FC<Props> = ({ data, isLoading, showedTab, reload }) => {
  const { message, modal } = App.useApp();
  const [form] = Form.useForm<FilterForm>();

  const t = useI18nTranslateToString();
  const userStore = useStore(UserStore);
  const DisplayedStateI18nTexts = getDisplayedStateI18nTexts(t);

  const [rangeSearchStatus, setRangeSearchStatus] = useState<FilteredStatus>("ALL");
  const [currentPageNum, setCurrentPageNum] = useState<number>(1);
  const [currentSortInfo, setCurrentSortInfo] = useState<{ field: string | null | undefined; order: SortOrder }>({
    field: null,
    order: null,
  });

  const [query, setQuery] = useState<FilterForm>({
    accountName: undefined,
    ownerIdOrName: undefined,
  });

  const filteredData = useMemo(() => {
    if (!data) return undefined;

    const filtered = data.results.filter((x) => {
      const dataMatchedAccount = !query.accountName || x.accountName.includes(query.accountName);

      const dataMatchedOwner =
        !query.ownerIdOrName || x.ownerId.includes(query.ownerIdOrName) || x.ownerName.includes(query.ownerIdOrName);

      const dataMatchedState =
        rangeSearchStatus === FilteredTypes.ALL ||
        (rangeSearchStatus !== FilteredTypes.ALL && x.displayedState === FilteredTypes[rangeSearchStatus]);

      return dataMatchedAccount && dataMatchedOwner && dataMatchedState;
    });

    return filtered;
  }, [data, query, rangeSearchStatus]);

  const searchData = useMemo(
    () =>
      data
        ? data.results.filter(
            (x) =>
              (!query.accountName || x.accountName.includes(query.accountName)) &&
              (!query.ownerIdOrName ||
                x.ownerId.includes(query.ownerIdOrName) ||
                x.ownerName.includes(query.ownerIdOrName)),
          )
        : undefined,
    [data, query],
  );

  const accountStatusCount = useMemo(() => {
    if (!searchData)
      return {
        DISPLAYED_BLOCKED: 0,
        DISPLAYED_FROZEN: 0,
        DISPLAYED_BELOW_BLOCK_THRESHOLD: 0,
        DISPLAYED_NORMAL: 0,
        DISPLAYED_DELETED: 0,
        ALL: 0,
      };
    const counts = {
      DISPLAYED_FROZEN: searchData.filter(
        (account) => account.displayedState === DisplayedAccountState.DISPLAYED_FROZEN,
      ).length,
      DISPLAYED_BLOCKED: searchData.filter(
        (account) => account.displayedState === DisplayedAccountState.DISPLAYED_BLOCKED,
      ).length,
      DISPLAYED_BELOW_BLOCK_THRESHOLD: searchData.filter(
        (account) => account.displayedState === DisplayedAccountState.DISPLAYED_BELOW_BLOCK_THRESHOLD,
      ).length,
      DISPLAYED_NORMAL: searchData.filter(
        (account) => account.displayedState === DisplayedAccountState.DISPLAYED_NORMAL,
      ).length,
      DISPLAYED_DELETED: searchData.filter(
        (account) => account.displayedState === DisplayedAccountState.DISPLAYED_DELETED,
      ).length,
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

  const handleExport = async (encoding: Encoding) => {
    const total = filteredData?.length || 0;
    // 获取浏览器时区
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    if (total > MAX_EXPORT_COUNT) {
      message.error(t(pCommon("exportMaxDataErrorMsg"), [MAX_EXPORT_COUNT]));
    } else if (total <= 0) {
      message.error(t(pCommon("exportNoDataErrorMsg")));
    } else {
      window.location.href = urlToExport({
        exportApi: "exportAccount",
        columns: exportOptions.map((o) => o.value),
        count: total,
        encoding,
        timeZone, // 将浏览器时区作为参数传递到后端
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

    const tenant = showedTab === "PLATFORM" ? [{ label: t(p("tenant")), value: "tenantName" }] : [];
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
            const { ownerIdOrName, accountName } = await form.validateFields();
            setQuery({ accountName: accountName?.trim(), ownerIdOrName: ownerIdOrName?.trim() });
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
            <Button type="primary" htmlType="submit">
              {t(pCommon("search"))}
            </Button>
          </Form.Item>
          <Form.Item>
            <ExportFileModaLButton onExport={handleExport}>{t(pCommon("export"))}</ExportFileModaLButton>
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
        rowKey="accountName"
        scroll={{ x: filteredData?.length ? 1200 : true }}
        onChange={handleTableChange}
      >
        <Table.Column<AdminAccountInfo>
          dataIndex="accountName"
          title={t(p("account"))}
          sorter={(a, b) => a.accountName.localeCompare(b.accountName)}
          sortDirections={["ascend", "descend"]}
          sortOrder={currentSortInfo.field === "accountName" ? currentSortInfo.order : null}
        />
        <Table.Column<AdminAccountInfo>
          dataIndex="ownerName"
          width="20%"
          title={t(p("owner"))}
          render={(_, r) => `${r.ownerName}（ID: ${r.ownerId}）`}
          sorter={(a, b) => compareNullableString(a.ownerName, b.ownerName)}
          sortDirections={["ascend", "descend"]}
          sortOrder={currentSortInfo.field === "ownerName" ? currentSortInfo.order : null}
        />
        <Table.Column<AdminAccountInfo>
          dataIndex="userCount"
          width="8%"
          title={t(pCommon("userCount"))}
          sortDirections={["ascend", "descend"]}
          sortOrder={currentSortInfo.field === "userCount" ? currentSortInfo.order : null}
          sorter={(a, b) => compareNullableNumber(a.userCount, b.userCount)}
        />
        {/* 只在平台管理下的账户列表中显示 */}
        {showedTab === "PLATFORM" && (
          <Table.Column<AdminAccountInfo>
            dataIndex="tenantName"
            width="10%"
            title={t(p("tenant"))}
            sortDirections={["ascend", "descend"]}
            sortOrder={currentSortInfo.field === "tenantName" ? currentSortInfo.order : null}
            sorter={(a, b) => compareNullableString(a.tenantName, b.tenantName)}
          />
        )}
        <Table.Column<AdminAccountInfo>
          dataIndex="balance"
          width="13%"
          title={`${t(pCommon("balance"))} (${t(pCommon("unit"))})`}
          sorter={(a, b) => moneyToNumber(a.balance) - moneyToNumber(b.balance)}
          sortDirections={["ascend", "descend"]}
          sortOrder={currentSortInfo.field === "balance" ? currentSortInfo.order : null}
          render={(b: Money) => moneyToString(b)}
        />
        <Table.Column<AdminAccountInfo>
          dataIndex="blockThresholdAmount"
          title={
            <Space>
              {`${t(pCommon("blockThresholdAmount"))} (${t(pCommon("unit"))})`}
              <Tooltip title={t(p("blockThresholdAmountTooltip"))}>
                <ExclamationCircleOutlined />
              </Tooltip>
            </Space>
          }
          render={(_, r) => moneyToString(r.blockThresholdAmount ?? r.defaultBlockThresholdAmount)}
          sortDirections={["ascend", "descend"]}
          sortOrder={currentSortInfo.field === "blockThresholdAmount" ? currentSortInfo.order : null}
          sorter={(a, b) =>
            compareNullableNumber(
              moneyToNumber(a.blockThresholdAmount ?? a.defaultBlockThresholdAmount),
              moneyToNumber(b.blockThresholdAmount ?? b.defaultBlockThresholdAmount),
            )
          }
        />
        <Table.Column<AdminAccountInfo>
          dataIndex="displayedState"
          width="7%"
          title={
            <Space>
              {t(p("status"))}
              <Popover
                title={t(p("statusTooltip"))}
                content={
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
                }
              >
                <ExclamationCircleOutlined />
              </Popover>
            </Space>
          }
          render={(s) => {
            return (
              <Tag color={s === DisplayedAccountState.DISPLAYED_NORMAL ? "green" : "red"}>
                {DisplayedStateI18nTexts[s]}
              </Tag>
            );
          }}
          sortDirections={["ascend", "descend"]}
          sortOrder={currentSortInfo.field === "displayedState" ? currentSortInfo.order : null}
          sorter={(a, b) => compareNullableNumber(a.displayedState, b.displayedState)}
        />
        <Table.Column<AdminAccountInfo>
          dataIndex="comment"
          ellipsis
          title={t(p("comment"))}
          sortDirections={["ascend", "descend"]}
          sortOrder={currentSortInfo.field === "comment" ? currentSortInfo.order : null}
          sorter={(a, b) => compareNullableString(a.comment, b.comment)}
        />
        <Table.Column<AdminAccountInfo>
          title={t(pCommon("operation"))}
          width="27%"
          fixed="right"
          render={(_, r) => (
            <Space split={<Divider type="vertical" />}>
              {/* 只在租户管理下的账户列表中显示管理成员和封锁阈值 */}
              {showedTab === "TENANT" &&
                (r.state !== AccountState.DELETED ? (
                  <>
                    <Link href={{ pathname: `/tenant/accounts/${r.accountName}/users` }}>{t(p("mangerMember"))}</Link>
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
                ))}
              {r.state === AccountState.BLOCKED_BY_ADMIN && (
                <a
                  onClick={() => {
                    modal.confirm({
                      title: t(p("unblockConfirmTitle")),
                      icon: <ExclamationCircleOutlined />,
                      content: t(p("unblockConfirmContent"), [r.tenantName, r.accountName]),
                      onOk: async () => {
                        await api
                          .unblockAccount({
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
              {!r.isInWhitelist && (r.state === AccountState.NORMAL || r.state === AccountState.FROZEN) && (
                <a
                  onClick={() => {
                    modal.confirm({
                      title: t(p("blockConfirmTitle")),
                      icon: <ExclamationCircleOutlined />,
                      content: t(p("blockConfirmContent"), [r.tenantName, r.accountName]),
                      onOk: async () => {
                        await api
                          .blockAccount({
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
                  {" "}
                  {t(p("block"))}
                </a>
              )}
              {showedTab === "TENANT" &&
                deleteEnabled === true &&
                (r.state === AccountState.DELETED ? (
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
                        key: "deleteAccount",
                      });

                      await api
                        .deleteAccount({
                          query: {
                            ownerId: inputUserId,
                            accountName: inputAccountName,
                            comment: comment,
                          },
                        })
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
                        .httpError(501, (e) => {
                          message.destroy("deleteAccount");
                          message.error({
                            content: e.message,
                            duration: 4,
                          });
                        })
                        .then(() => {
                          message.success(t(p("deleteSuccess")));
                          message.destroy("deleteAccount");

                          // 修改userStore中user的accountAffiliations，保证菜单栏已删除账户同步不显示
                          const userInfo = userStore.user;
                          if (userInfo) {
                            const newAccountAffiliations = userInfo.accountAffiliations.map((acc) => {
                              if (acc.accountName === inputAccountName) {
                                return { ...acc, accountState: AccountState.DELETED };
                              }
                              return acc;
                            });

                            // 使用 setUser 方法更新 userStore 中的用户信息
                            userStore.setUser({
                              ...userInfo,
                              accountAffiliations: newAccountAffiliations,
                            });
                          }

                          reload();
                        })
                        .catch(() => {
                          message.error(t(p("deleteFail")));
                          message.destroy("deleteAccount");

                          reload();
                        });
                    }}
                  >
                    {t(p("delete"))}
                  </DeleteEntityModalLink>
                ))}
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
      ></DeleteEntityFailedModal>
    </div>
  );
};
