import type { GetJobFilter, GetJobInfoSchema } from "src/pages/api/job/jobInfo";
import type { FilterForm } from "src/utils/jobIds";

import { QuestionCircleOutlined } from "@ant-design/icons";
import { TrimInput } from "@scow/lib-web/build/components/styledAntdCom/TrimInput";
import { formatDateTime, getDefaultPresets } from "@scow/lib-web/build/utils/datetime";
import { DEFAULT_PAGE_SIZE } from "@scow/lib-web/build/utils/pagination";
import { JobInfo } from "@scow/protos/build/common/ended_job";
import { Money } from "@scow/protos/build/common/money";
import { Static } from "@sinclair/typebox";
import { App, Button, DatePicker, Divider, Form, Input, Popover, Space, Table } from "antd";
import dayjs from "dayjs";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { useAsync } from "react-async";
import { useStore } from "simstate";
import { api } from "src/apis";
import { ClusterSelector } from "src/components/ClusterSelector";
import { FilterFormContainer, FilterFormTabs } from "src/components/FilterFormContainer";
import { TableTitle } from "src/components/TableTitle";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { Encoding } from "src/models/exportFile";
import { exportJobColumns, SearchType } from "src/models/job";
import { ExportFileModaLButton } from "src/pageComponents/common/exportFileModal";
import { MAX_EXPORT_COUNT, urlToExport } from "src/pageComponents/file/apis";
import { HistoryJobDrawer } from "src/pageComponents/job/HistoryJobDrawer";
import { JobPriceChangeModal } from "src/pageComponents/tenant/JobPriceChangeModal";
import { TenantSelector } from "src/pageComponents/tenant/TenantSelector";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { getClusterName } from "src/utils/cluster";
import { publicConfig } from "src/utils/config";
import { useJobIdsInput, validateJobIds } from "src/utils/jobIds";
import { moneyToString, nullableMoneyToString } from "src/utils/money";
import { useAuthorizedClusters } from "src/utils/useAuthorizedClusters";

interface PageInfo {
  page: number;
  pageSize?: number;
}

interface Props {
  tenantName?: string;
}

interface DiffQuery {
  userIdOrName?: string | undefined;
  ownerIdOrName?: string | undefined;
  accountName?: string | undefined;
  tenantName?: string | undefined;
  jobIds?: string | undefined;
  jobEndTimeStart?: string | undefined;
  jobEndTimeEnd?: string | undefined;
  clusters?: string[] | undefined;
}

interface JobItem {
  idJob: number;
  biJobIndex: number;
  jobName: string;
  accountPrice?: Money;
  tenantPrice?: Money;
  cluster: string;
  tenantName?: string;
  [key: string]: any;
}

const endedJobRowKey = (i: Pick<JobInfo, "cluster" | "biJobIndex" | "idJob">) =>
  `${i.cluster}::${i.biJobIndex}::${i.idJob}`;

const p = prefix("pageComp.tenant.adminJobTable.");
const pJobPriceChangeModal = prefix("pageComp.tenant.jobPriceChangeModal.");
const pCommon = prefix("common.");

const filterFormToQuery = (query: FilterForm, rangeSearch: boolean): GetJobFilter => {
  return {
    tenantName: query.tenantName || undefined,
    userIdOrName: rangeSearch ? query.userIdOrName || undefined : undefined,
    ownerIdOrName: rangeSearch ? query.ownerIdOrName || undefined : undefined,
    accountName: rangeSearch ? query.accountName || undefined : undefined,
    jobEndTimeStart: rangeSearch ? query.jobEndTime[0].toISOString() : undefined,
    jobEndTimeEnd: rangeSearch ? query.jobEndTime[1].toISOString() : undefined,
    jobIds: !rangeSearch ? query.jobIds || undefined : undefined,
    clusters: query.clusters?.map((x) => x.id),
  };
};

export const AdminJobTable: React.FC<Props & { platform?: boolean }> = ({ platform = false, tenantName }) => {
  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;

  const { message } = App.useApp();
  const resourceEnabled = publicConfig.SCOW_RESOURCE_ENABLED;
  const tenantResourceEnabled = resourceEnabled && !platform;

  const rangeSearch = useRef(true);
  const [currentDiffQuery, setCurrentDiffQuery] = useState<DiffQuery | undefined>(undefined);

  const { publicConfigClusters } = useStore(ClusterInfoStore);
  const [query, setQuery] = useState<FilterForm>(() => {
    const now = dayjs();
    return {
      jobIds: undefined,
      userIdOrName: "",
      ownerIdOrName: "",
      accountName: "",
      tenantName: undefined,
      jobEndTime: [now.subtract(1, "week").startOf("day"), now.endOf("day")],
      clusters: [],
    };
  });
  const [form] = Form.useForm<FilterForm>();

  const fetchAuthorizedClusterIds = useCallback(async () => {
    const resp = await api.getTenantAssignedClustersAndPartitions({});
    return Object.keys(resp.assignedClusterPartitions ?? {});
  }, []);

  const authorizedClusterIds = useAuthorizedClusters(form, setQuery, tenantResourceEnabled, fetchAuthorizedClusterIds);

  const [pageInfo, setPageInfo] = useState<PageInfo>({ page: 1, pageSize: DEFAULT_PAGE_SIZE });

  const clusterIds = useMemo(
    () => (!query.clusters || query.clusters.length === 0 ? [] : query.clusters.map((x) => x.id)),
    [query.clusters],
  );

  const promiseFn = useCallback(async () => {
    const diffQuery = {
      ...filterFormToQuery(query, rangeSearch.current),
      tenantName: platform ? query.tenantName || undefined : tenantName,
      clusters: clusterIds,
    };
    setCurrentDiffQuery(diffQuery);
    return await api.getJobInfo({
      query: {
        ...diffQuery,
        page: pageInfo.page,
        pageSize: pageInfo.pageSize,
      },
    });
  }, [pageInfo, query, clusterIds, platform, tenantName]);

  const { data, isLoading, reload } = useAsync({ promiseFn });

  const finalPriceText = {
    account: t(p("tenantPrice")),
    tenant: t(p("platformPrice")),
  };

  const handleExport = async (encoding: Encoding) => {
    const totalCount = data?.totalCount ?? 0;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    if (totalCount > MAX_EXPORT_COUNT) {
      message.error(t(pCommon("exportMaxDataErrorMsg"), [MAX_EXPORT_COUNT]));
    } else if (totalCount <= 0) {
      message.error(t(pCommon("exportNoDataErrorMsg")));
    } else {
      window.location.href = urlToExport({
        encoding,
        exportApi: "exportJobRecord",
        columns: [...(platform ? ["tenantName"] : []), ...exportJobColumns, "tenantPrice"],
        count: totalCount,
        timeZone,
        query: {
          ...currentDiffQuery,
          searchType: SearchType.TENANT,
          finalPriceText: JSON.stringify(
            Object.fromEntries(Object.entries(finalPriceText).map(([k, v]) => [k, `${v} (${t(pCommon("unit"))})`])),
          ),
          publicConfigClusters: JSON.stringify(publicConfigClusters),
        },
      });
    }
  };

  // 创建作业ID输入处理器
  const jobIdsHandlers = useJobIdsInput(form, t(p("onlyNumbersAndCommas")));

  return (
    <div>
      <FilterFormContainer>
        <Form<FilterForm>
          form={form}
          initialValues={query}
          onFinish={async () => {
            const currentQuery = await form.validateFields();
            setQuery({
              ...currentQuery,
              userIdOrName: currentQuery.userIdOrName?.trim() ?? "",
              ownerIdOrName: currentQuery.ownerIdOrName?.trim() ?? "",
              accountName: currentQuery.accountName?.trim() ?? "",
              tenantName: platform ? currentQuery.tenantName || undefined : tenantName,
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
              {
                title: t(p("batch")),
                key: "range",
                node: (
                  <>
                    <Form.Item
                      label={
                        <Space>
                          {t(pCommon("cluster"))}
                          {tenantResourceEnabled ? (
                            <Popover title={t("component.others.allClustersTooltip")}>
                              <QuestionCircleOutlined />
                            </Popover>
                          ) : null}
                        </Space>
                      }
                      name="clusters"
                    >
                      <ClusterSelector
                        authorizedClusterIds={tenantResourceEnabled ? authorizedClusterIds : undefined}
                      />
                    </Form.Item>
                    {platform ? (
                      <Form.Item label={t(pCommon("tenant"))} name="tenantName">
                        <TenantSelector placeholder={t(pCommon("selectTenant"))} />
                      </Form.Item>
                    ) : undefined}
                    <Form.Item label={t(pCommon("user"))} name="userIdOrName">
                      <TrimInput placeholder={t(p("userIdOrNamePlaceholder"))} />
                    </Form.Item>
                    <Form.Item label={t(pCommon("account"))} name="accountName">
                      <TrimInput />
                    </Form.Item>
                    <Form.Item label={t(pCommon("accountOwner"))} name="ownerIdOrName">
                      <TrimInput placeholder={t(p("ownerIdOrNamePlaceholder"))} />
                    </Form.Item>
                    <Form.Item label={t(p("jobEndTime"))} name="jobEndTime">
                      <DatePicker.RangePicker showTime allowClear={false} presets={getDefaultPresets(languageId)} />
                    </Form.Item>
                  </>
                ),
              },
              {
                title: t(p("precise")),
                key: "precision",
                node: (
                  <>
                    <Form.Item
                      label={
                        <Space>
                          {t(pCommon("cluster"))}
                          {tenantResourceEnabled ? (
                            <Popover title={t("component.others.allClustersTooltip")}>
                              <QuestionCircleOutlined />
                            </Popover>
                          ) : null}
                        </Space>
                      }
                      name="clusters"
                    >
                      <ClusterSelector
                        authorizedClusterIds={tenantResourceEnabled ? authorizedClusterIds : undefined}
                      />
                    </Form.Item>
                    <Form.Item
                      label={t(pCommon("clusterWorkId"))}
                      name="jobIds"
                      validateTrigger={["onChange", "onBlur"]}
                      rules={[
                        {
                          validator: (_, value) =>
                            validateJobIds(value).catch(() => Promise.reject(new Error(t(p("onlyNumbersAndCommas"))))),
                        },
                      ]}
                    >
                      {/* 已实现空格是非法输入的校验,且自己有OnBlur逻辑，不重复使用TrimInput */}
                      <Input
                        style={{ minWidth: "160px" }}
                        placeholder={t(p("searchTypePlaceholder"))}
                        onCompositionEnd={jobIdsHandlers.handleCompositionEnd}
                        onChange={jobIdsHandlers.handleChange}
                      />
                    </Form.Item>
                    {platform ? (
                      <Form.Item label={t(pCommon("tenant"))} name="tenantName">
                        <TenantSelector placeholder={t(pCommon("selectTenant"))} />
                      </Form.Item>
                    ) : undefined}
                  </>
                ),
              },
            ]}
          />
        </Form>
      </FilterFormContainer>
      <JobInfoTable
        reload={reload}
        data={data}
        isLoading={isLoading}
        pageInfo={pageInfo}
        setPageInfo={setPageInfo}
        filter={query}
        rangeSearch={rangeSearch.current}
        platform={platform}
        tenantName={tenantName}
      />
    </div>
  );
};

const ChangePriceButton: React.FC<{
  filter: GetJobFilter;
  count: number;
  selectedJobs: JobItem[];
  target: "account" | "tenant";
  reload: () => void;
  setOpen: (openFlag: boolean) => void;
  setSelectedJobs: (selectJobs: JobItem[]) => void;
  open: boolean;
}> = ({ filter, count, selectedJobs, target, open, reload, setOpen, setSelectedJobs }) => {
  const t = useI18nTranslateToString();
  const targetPriceText = target === "account" ? t(pJobPriceChangeModal("jobPrice")) : t(p("platformPrice"));

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={!(selectedJobs?.length > 0)}>
        {t(p("adjustPrice"), [targetPriceText])}
      </Button>
      <JobPriceChangeModal
        jobs={selectedJobs}
        reload={reload}
        onClose={() => setOpen(false)}
        open={open}
        setSelectedJobs={setSelectedJobs}
        filter={filter}
        jobCount={count}
        target={target}
      />
    </>
  );
};

interface JobInfoTableProps {
  data: Static<(typeof GetJobInfoSchema)["responses"]["200"]> | undefined;
  pageInfo: PageInfo;
  setPageInfo?: (info: PageInfo) => void;
  isLoading: boolean;
  filter: FilterForm;
  reload: () => void;
  rangeSearch: boolean;
  platform: boolean;
  tenantName?: string;
}

const JobInfoTable: React.FC<JobInfoTableProps> = ({
  data,
  pageInfo,
  setPageInfo,
  isLoading,
  filter,
  reload,
  rangeSearch,
  platform,
  tenantName,
}) => {
  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;
  const { publicConfigClusters } = useStore(ClusterInfoStore);

  const [previewItem, setPreviewItem] = useState<JobInfo | undefined>(undefined);
  const [selectedJobs, setSelectedJobs] = useState<JobItem[]>([]);
  const [open, setOpen] = useState(false);
  const changePriceFilter = useMemo(
    () => ({
      ...filterFormToQuery(filter, rangeSearch),
      tenantName: platform ? filter.tenantName || undefined : tenantName,
    }),
    [filter, rangeSearch, platform, tenantName],
  );

  return (
    <>
      <TableTitle justify="space-between">
        {data ? (
          <div>
            <span>
              {t(p("jobNumber"))}
              <span>{data.totalCount}</span>
            </span>
            <Divider type="vertical" />
            <span>
              {t(p("tenantPriceSum"))}
              <span>
                {nullableMoneyToString(data.totalAccountPrice)} {t(pCommon("unit"))}
              </span>
            </span>
            <Divider type="vertical" />
            <span>
              {t(p("platformPriceSum"))}
              <span>
                {nullableMoneyToString(data.totalTenantPrice)} {t(pCommon("unit"))}
              </span>
            </span>
          </div>
        ) : undefined}
        <Space>
          <ChangePriceButton
            reload={reload}
            filter={changePriceFilter}
            count={data ? data.totalCount : 0}
            selectedJobs={selectedJobs}
            target={platform ? "tenant" : "account"}
            setSelectedJobs={setSelectedJobs}
            setOpen={setOpen}
            open={open}
          />
        </Space>
      </TableTitle>
      <Table<JobInfo>
        rowKey={endedJobRowKey}
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
        scroll={{ x: data?.jobs?.length ? 2200 : true }}
        rowSelection={{
          type: "checkbox",
          onChange: (_, selectedRows) => {
            setSelectedJobs(selectedRows);
          },
          selectedRowKeys: selectedJobs?.map(endedJobRowKey),
        }}
      >
        <Table.Column dataIndex="idJob" width="4.5%" title={t(pCommon("clusterWorkId"))} />
        {platform ? <Table.Column dataIndex="tenantName" width="8%" ellipsis title={t(pCommon("tenant"))} /> : null}
        <Table.Column dataIndex="jobName" width="12%" ellipsis title={t(pCommon("workName"))} />
        <Table.Column<JobInfo>
          dataIndex="user"
          width="9%"
          ellipsis
          title={t(pCommon("user"))}
          render={(user, record) =>
            !record.userName ? t(pCommon("nonPlatformUser")) : `${record.userName} (ID:${user})`
          }
        />
        <Table.Column dataIndex="account" width="7%" ellipsis title={t(pCommon("account"))} />
        <Table.Column<JobInfo>
          dataIndex="accountOwnerName"
          width="9%"
          ellipsis
          title={t(pCommon("accountOwner"))}
          render={(_, record) => `${record.accountOwnerName ?? "-"} (ID:${record.accountOwnerId ?? "-"})`}
        />
        <Table.Column<JobInfo>
          dataIndex="cluster"
          width="5%"
          ellipsis
          title={t(pCommon("cluster"))}
          render={(cluster) => getClusterName(cluster, languageId, publicConfigClusters)}
        />
        <Table.Column dataIndex="partition" width="6%" ellipsis title={t(pCommon("partition"))} />
        <Table.Column dataIndex="qos" width="6%" ellipsis title="QOS" />
        <Table.Column<JobInfo>
          dataIndex="timeSubmit"
          width="8.5%"
          title={t(pCommon("timeSubmit"))}
          render={(time: string) => formatDateTime(time)}
        />
        <Table.Column<JobInfo>
          dataIndex="timeEnd"
          width="8.5%"
          title={t(pCommon("timeEnd"))}
          render={(time: string) => formatDateTime(time)}
        />
        <Table.Column<JobInfo>
          dataIndex="accountPrice"
          width="6.1%"
          title={`${t(p("tenantPrice"))} (${t(pCommon("unit"))})`}
          render={(price: Money) => moneyToString(price)}
        />
        <Table.Column<JobInfo>
          dataIndex="tenantPrice"
          width="6%"
          title={`${t(p("platformPrice"))} (${t(pCommon("unit"))})`}
          render={(price: Money) => moneyToString(price)}
        />
        <Table.Column<JobInfo>
          title={t(pCommon("more"))}
          fixed="right"
          width="10%"
          render={(_, r) => (
            <Space size={16}>
              <a
                onClick={() => {
                  setOpen(true);
                  setSelectedJobs([r]);
                }}
                style={{ marginRight: 10 }}
              >
                {t(pJobPriceChangeModal("adjustBill"), [
                  platform ? t(p("platformPrice")) : t(pJobPriceChangeModal("jobPrice")),
                ])}
              </a>
              <a onClick={() => setPreviewItem(r)}>{t(pCommon("detail"))}</a>
            </Space>
          )}
        />
      </Table>
      <HistoryJobDrawer
        open={previewItem !== undefined}
        item={previewItem}
        onClose={() => setPreviewItem(undefined)}
        showedPrices={["account", "tenant"]}
      />
    </>
  );
};
