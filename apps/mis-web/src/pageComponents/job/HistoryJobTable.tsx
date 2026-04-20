import type { GetJobInfoSchema } from "src/pages/api/job/jobInfo";
import type { Cluster } from "src/utils/cluster";

import { HttpError } from "@ddadaal/next-typed-api-routes-runtime";
import { TrimInput as Input } from "@scow/lib-web/build/components/styledAntdCom/TrimInput";
import { formatDateTime, getDefaultPresets } from "@scow/lib-web/build/utils/datetime";
import { useDidUpdateEffect } from "@scow/lib-web/build/utils/hooks";
import { DEFAULT_PAGE_SIZE } from "@scow/lib-web/build/utils/pagination";
import { JobInfo } from "@scow/protos/build/common/ended_job";
import { Money } from "@scow/protos/build/common/money";
import { Static } from "@sinclair/typebox";
import { App, AutoComplete, Button, DatePicker, Divider, Form, InputNumber, Space, Table, Tooltip } from "antd";
import dayjs from "dayjs";
import { useRouter } from "next/router";
import React, { useCallback, useRef, useState } from "react";
import { useAsync } from "react-async";
import { useStore } from "simstate";
import { api } from "src/apis";
import { DetailIcon } from "src/assets/operationIcon";
import { ClusterSelector } from "src/components/ClusterSelector";
import { FilterFormContainer, FilterFormTabs } from "src/components/FilterFormContainer";
import { TableTitle } from "src/components/TableTitle";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { Encoding } from "src/models/exportFile";
import { exportJobColumns, JobSortBy, JobSortOrder, SearchType } from "src/models/job";
import { ExportFileModaLButton } from "src/pageComponents/common/exportFileModal";
import { MAX_EXPORT_COUNT, urlToExport } from "src/pageComponents/file/apis";
import { HistoryJobDrawer } from "src/pageComponents/job/HistoryJobDrawer";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { getClusterName, getSortedClusterValues } from "src/utils/cluster";
import { moneyToString, nullableMoneyToString } from "src/utils/money";

interface FilterForm {
  jobEndTime: [dayjs.Dayjs, dayjs.Dayjs];
  jobId: number | undefined;
  accountName?: string;
  userIdOrName?: string;
  ownerIdOrName?: string;
  name?: string;
  clusters: Cluster[];
}

interface Props {
  userId?: string;
  accountNames: string[] | string;
  filterAccountName?: boolean;
  filterUser?: boolean;
  showUser: boolean;
  showAccount: boolean;
  showOwner?: boolean;
  showedPrices: ("tenant" | "account")[];
  priceTexts?: { tenant?: string; account?: string };
}

interface Sorter {
  field: JobSortBy | undefined;
  order: JobSortOrder | undefined;
}

interface DiffQuery {
  userId?: string;
  userIdOrName?: string;
  ownerIdOrName?: string;
  accountName?: string;
  jobId?: number;
  jobEndTimeStart?: string;
  jobEndTimeEnd?: string;
}

const p = prefix("pageComp.job.historyJobTable.");
const pCommon = prefix("common.");
const priceText = {
  tenant: "platformPrice",
  account: "tenantPrice",
} as const;

export const JobTable: React.FC<Props> = ({
  userId, accountNames, filterAccountName = true, filterUser = true,
  showAccount, showUser, showOwner = false, showedPrices, priceTexts,
}) => {
  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;

  const { message } = App.useApp();

  const rangeSearch = useRef(true);

  const [pageInfo, setPageInfo] = useState({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
  const [selectedAccountName, setSelectedAccountName] = useState<string | undefined>(undefined);

  // 防止用户切换批量/精确搜索、修改账户条件，但还没点击搜索时，导出结果已经跟随条件变化的情况。
  const [currentDiffQuery, setCurrentDiffQuery] = useState<DiffQuery | undefined>(undefined);

  const { publicConfigClusters, clusterSortedIdList, activatedClusters } = useStore(ClusterInfoStore);
  const sortedClusters = getSortedClusterValues(publicConfigClusters, clusterSortedIdList).filter((x) =>
    Object.keys(activatedClusters).includes(x.id),
  );

  const [query, setQuery] = useState<FilterForm>(() => {
    const now = dayjs();
    return {
      jobEndTime: [now.subtract(1, "week").startOf("day"), now.endOf("day")],
      jobId: undefined,
      clusters: sortedClusters,
      accountName: typeof accountNames === "string" ? accountNames : undefined,
    };
  });

  useDidUpdateEffect(() => {
    setPageInfo({ page: 1, pageSize: pageInfo.pageSize });
    setQuery((q) => ({
      ...q,
      accountName: Array.isArray(accountNames) ? accountNames[0] : accountNames,
    }));
  }, [accountNames]);

  const [form] = Form.useForm<FilterForm>();

  // 定义排序状态
  const [sorter, setSorter] = useState<Sorter>({ field: undefined, order: undefined });

  const promiseFn = useCallback(async () => {
    // userId 仅作为页面上下文约束，不是前端搜索框字段。
    const fixedUserQuery = userId ? { userId } : {};

    // 根据 rangeSearch.current来判断是批量/精确搜索，
    // accountName 根据accountNames是否数组来判断顶部导航类型，如是用户空间用输入值，账户管理则用props中的accountNames限制搜索范围
    const diffQuery = rangeSearch.current ? {
      ...fixedUserQuery,
      ...(!userId ? { userIdOrName: query.userIdOrName || undefined } : {}),
      ownerIdOrName: query.ownerIdOrName || undefined,
      accountName: Array.isArray(accountNames) ? selectedAccountName : accountNames,
      jobEndTimeStart: query.jobEndTime[0].toISOString(),
      jobEndTimeEnd: query.jobEndTime[1].toISOString(),
    } : {
      ...fixedUserQuery,
      jobId: query.jobId,
      accountName: Array.isArray(accountNames) ? undefined : accountNames,
    };

    setCurrentDiffQuery(diffQuery);

    return await api
      .getJobInfo({
        query: {
          ...diffQuery,
          sortBy: sorter.field,
          sortOrder: sorter.order,
          page: pageInfo.page,
          pageSize: pageInfo.pageSize,
          clusters: query.clusters?.map((x) => x.id),
        },
      })
      .catch((e: HttpError) => {
        if (e.status === 403) {
          message.error(t(p("noAuth")));
          return undefined;
        } else {
          throw e;
        }
      });
  }, [pageInfo, query, sorter]);

  const { data, isLoading } = useAsync({ promiseFn });

  const finalPriceText = {
    account: priceTexts?.account ?? t(p(priceText.account)),
    tenant: priceTexts?.tenant ?? t(p(priceText.tenant)),
  };

  const handleExport = async (encoding: Encoding) => {
    const totalCount = data?.totalCount ?? 0;

    // 获取浏览器时区
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    if (totalCount > MAX_EXPORT_COUNT) {
      message.error(t(pCommon("exportMaxDataErrorMsg"), [MAX_EXPORT_COUNT]));
    } else if (totalCount <= 0) {
      message.error(t(pCommon("exportNoDataErrorMsg")));
    } else {
      window.location.href = urlToExport({
        encoding,
        exportApi: "exportJobRecord",
        columns: exportJobColumns,
        count: totalCount,
        timeZone, // 将浏览器时区作为参数传递到后端
        query: {
          ...currentDiffQuery,
          searchType: SearchType.NORMAL,
          clusters: query.clusters?.map((x) => x.id),
          finalPriceText: JSON.stringify(
            Object.fromEntries(Object.entries(finalPriceText).map(([k, v]) => [k, `${v} (${t(pCommon("unit"))})`])),
          ),
          publicConfigClusters: JSON.stringify(publicConfigClusters),
        },
      });
    }
  };

  return (
    <div>
      <FilterFormContainer>
        <Form<FilterForm>
          form={form}
          initialValues={query}
          onFinish={async () => {
            const { userIdOrName, ownerIdOrName, name, ...currentQuery } = await form.validateFields();
            setQuery({
              userIdOrName: userIdOrName?.trim(),
              ownerIdOrName: ownerIdOrName?.trim(),
              name: name?.trim(),
              ...currentQuery,
            });
            setPageInfo({ page: 1, pageSize: pageInfo.pageSize });
          }}
        >
          <FilterFormTabs
            button={
              <Space>
                <Button type="primary" htmlType="submit">
                  {t(pCommon("search"))}
                </Button>
                <ExportFileModaLButton onExport={handleExport}>{t(pCommon("export"))}</ExportFileModaLButton>
              </Space>
            }
            onChange={(a) => (rangeSearch.current = a === "range")}
            tabs={[
              { title: t(p("batchSearch")), key: "range", node: (
                <>
                  <Form.Item label={t(pCommon("cluster"))} name="clusters">
                    <ClusterSelector />
                  </Form.Item>
                  {
                    filterUser ? (
                      <Form.Item label={t(pCommon("user"))} name="userIdOrName">
                        <Input placeholder={t(p("userIdOrNamePlaceholder"))} />
                      </Form.Item>
                    ) : undefined
                  }
                  {
                    filterAccountName ? (
                      <Form.Item label={t("common.account")} name="name">
                        <AutoComplete
                          style={{ minWidth: 150 }}
                          allowClear
                          options={(Array.isArray(accountNames) ? accountNames : [accountNames]).map((x) => ({
                            value: x,
                          }))}
                          placeholder={t("common.selectAccount")}
                          filterOption={(inputValue, option) =>
                            option!.value.toUpperCase().includes(inputValue.toUpperCase())
                          }
                          onChange={(value) => {
                            setSelectedAccountName(value || undefined);
                          }}
                          onBlur={() => {
                            const current = form.getFieldValue("name") as string | undefined;
                            const trimmed = current?.trim() ?? "";
                            form.setFieldValue("name", trimmed);
                            setSelectedAccountName(trimmed || undefined);
                          }}
                        />
                      </Form.Item>
                    ) : undefined
                  }
                  {
                    showOwner ? (
                      <Form.Item label={t(pCommon("accountOwner"))} name="ownerIdOrName">
                        <Input placeholder={t(p("ownerIdOrNamePlaceholder"))} />
                      </Form.Item>
                    ) : undefined}
                    <Form.Item label={t(p("jobEndTime"))} name="jobEndTime">
                      <DatePicker.RangePicker showTime presets={getDefaultPresets(languageId)} allowClear={false} />
                    </Form.Item>
                  </>
                ),
              },
              {
                title: t(p("precision")),
                key: "precision",
                node: (
                  <>
                    <Form.Item label={t(pCommon("cluster"))} name="clusters">
                      <ClusterSelector />
                    </Form.Item>
                    <Form.Item label={t(pCommon("workId"))} name="jobId">
                      <InputNumber style={{ minWidth: "160px" }} min={1} />
                    </Form.Item>
                  </>
                ),
              },
            ]}
          />
        </Form>
      </FilterFormContainer>

      <JobInfoTable
        data={data}
        isLoading={isLoading}
        pageInfo={pageInfo}
        setPageInfo={setPageInfo}
        setSorter={setSorter}
        showAccount={showAccount}
        showUser={showUser}
        showOwner={showOwner}
        showedPrices={showedPrices}
        priceTexts={priceTexts}
      />
    </div>
  );
};

interface JobInfoTableProps {
  data: Static<(typeof GetJobInfoSchema)["responses"]["200"]> | undefined;
  pageInfo: { page: number; pageSize: number };
  setPageInfo?: (info: { page: number; pageSize: number }) => void;
  isLoading: boolean;
  setSorter: (sorter: Sorter) => void;
  showAccount: boolean;
  showUser: boolean;
  showOwner?: boolean;
  showedPrices: ("tenant" | "account")[];
  priceTexts?: { tenant?: string; account?: string };
}

export const JobInfoTable: React.FC<JobInfoTableProps> = ({
  data, pageInfo, setPageInfo, setSorter, isLoading,
  showAccount, showUser, showOwner = false, showedPrices, priceTexts,
}) => {
  const router = useRouter();
  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;
  const { publicConfigClusters } = useStore(ClusterInfoStore);

  const [previewItem, setPreviewItem] = useState<JobInfo | undefined>(undefined);

  const handleTableChange = (pagination, filters, sorter) => {
    setSorter({
      field: sorter.field,
      order: sorter.order,
    });
  };

  const finalPriceText = {
    tenant: priceTexts?.tenant ?? t(p(priceText.tenant)),
    account: priceTexts?.account ?? t(p(priceText.account)),
  };

  return (
    <>
      <TableTitle justify="flex-start">
        {data ? (
          <div>
            <span>
              {t(p("jobNumber"))}：<span>{data.totalCount}</span>
            </span>
            {showedPrices.includes("account") ? (
              <>
                <Divider type="vertical" />
                <span>
                  {finalPriceText.account}
                  {t(pCommon("sum"))}：
                  <span>
                    {nullableMoneyToString(data.totalAccountPrice)} {t(pCommon("unit"))}
                  </span>
                </span>
              </>
            ) : undefined}
            {showedPrices.includes("tenant") ? (
              <>
                <Divider type="vertical" />
                <span>
                  {finalPriceText.tenant}
                  {t(pCommon("sum"))}：
                  <span>
                    {nullableMoneyToString(data.totalTenantPrice)} {t(pCommon("unit"))}
                  </span>
                </span>
              </>
            ) : undefined}
          </div>
        ) : undefined}
      </TableTitle>
      <Table
        onChange={handleTableChange}
        rowKey={(i) => `${i.cluster}::${i.biJobIndex}::${i.idJob}`}
        dataSource={data?.jobs}
        loading={isLoading}
        pagination={
          setPageInfo
            ? {
                current: pageInfo.page,
                defaultPageSize: DEFAULT_PAGE_SIZE,
                pageSize: pageInfo.pageSize,
                showSizeChanger: true,
                total: data?.totalCount,
                onChange: (page, pageSize) => setPageInfo({ page, pageSize }),
              }
            : false
        }
        tableLayout="fixed"
        scroll={{ x: data?.jobs?.length ? 1450 : true }}
      >
        <Table.Column<JobInfo>
          dataIndex="idJob"
          width="7%"
          title={t(pCommon("clusterWorkId"))}
          sorter={true}
        />
        <Table.Column<JobInfo>
          dataIndex="jobName"
          ellipsis
          title={t(pCommon("workName"))}
          sorter={true}
        />
        {
          showUser ? (
            <Table.Column<JobInfo>
              dataIndex="user"
              width="13%"
              ellipsis
              title={t(pCommon("user"))}
              render={(user,record) => `${record.userName} (ID:${user})`}
              sorter={true}
            />
          ) : undefined
        }
        {
          showAccount ? (
            <Table.Column<JobInfo>
              dataIndex="account"
              width="9%"
              ellipsis
              title={t(pCommon("account"))}
              sorter={true}
            />
          ) : undefined
        }
        {
          showOwner ? (
            <Table.Column<JobInfo>
              dataIndex="accountOwnerName"
              width="10%"
              ellipsis
              title={t(pCommon("accountOwner"))}
              render={(_, record) => `${record.accountOwnerName ?? "-"} (ID:${record.accountOwnerId ?? "-"})`}
              sorter={true}
            />
          ) : undefined
        }
        <Table.Column<JobInfo>
          dataIndex="cluster"
          title={t(pCommon("clusterName"))}
          width="10%"
          ellipsis
          render={(cluster) => getClusterName(cluster, languageId, publicConfigClusters)}
          sorter={true}
        />
        <Table.Column<JobInfo>
          dataIndex="partition"
          width="8.5%"
          ellipsis
          title={t(pCommon("partition"))}
          sorter={true}
        />
        <Table.Column<JobInfo> dataIndex="qos" width="8.5%" ellipsis title="QOS" sorter={true} />
        <Table.Column
          dataIndex="timeSubmit"
          width="10%"
          title={t(pCommon("timeSubmit"))}
          render={(time: string) => formatDateTime(time)}
          sorter={true}
        />
        <Table.Column<JobInfo>
          dataIndex="timeEnd"
          width="10%"
          title={t(pCommon("timeEnd"))}
          render={(time: string) => formatDateTime(time)}
          sorter={true}
        />
        {showedPrices.map((v, i) => (
          <Table.Column<JobInfo>
            key={i}
            dataIndex={`${v}Price`}
            width="8%"
            title={`${finalPriceText[v]} (${t(pCommon("unit"))})`}
            render={(price: Money) => moneyToString(price)}
          />
        ))}
        <Table.Column<JobInfo>
          title={t(pCommon("operation"))}
          width="5%"
          fixed="right"
          render={(_, r) => {
            return router.pathname === "/user/historyJobs" ? (
              <Tooltip title={t(pCommon("detail"))}>
                <DetailIcon onClick={() => setPreviewItem(r)} />
              </Tooltip>
            ) : (
              <a onClick={() => setPreviewItem(r)}>{t(pCommon("detail"))}</a>
            );
          }}
        />
      </Table>
      <HistoryJobDrawer
        open={previewItem !== undefined}
        item={previewItem}
        onClose={() => setPreviewItem(undefined)}
        showedPrices={showedPrices}
      />
    </>
  );
};
