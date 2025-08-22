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

import { formatDateTime, getDefaultPresets } from "@scow/lib-web/build/utils/datetime";
import { DEFAULT_PAGE_SIZE } from "@scow/lib-web/build/utils/pagination";
import { JobInfo } from "@scow/protos/build/common/ended_job";
import { Money } from "@scow/protos/build/common/money";
import { Static } from "@sinclair/typebox";
import { App, Button, DatePicker, Divider, Form, Input, InputNumber, Space, Table } from "antd";
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
import { SearchType } from "src/models/job";
import { ExportFileModaLButton } from "src/pageComponents/common/exportFileModal";
import { MAX_EXPORT_COUNT, urlToExport } from "src/pageComponents/file/apis";
import { HistoryJobDrawer } from "src/pageComponents/job/HistoryJobDrawer";
import { JobPriceChangeModal } from "src/pageComponents/tenant/JobPriceChangeModal";
import type { GetJobFilter, GetJobInfoSchema } from "src/pages/api/job/jobInfo";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import type { Cluster } from "src/utils/cluster";
import { getClusterName, getSortedClusterValues } from "src/utils/cluster";
import { moneyToString, nullableMoneyToString } from "src/utils/money";

interface PageInfo {
  page: number;
  pageSize?: number;
}

interface FilterForm {
  jobEndTime: [dayjs.Dayjs, dayjs.Dayjs];
  jobId: number | undefined;
  accountName: string;
  userId: string;
  clusters: Cluster[];
}

interface Props {

}

interface DiffQuery {
  userId?: string | undefined;
  accountName?: string | undefined;
  jobId?: number | undefined;
  jobEndTimeStart?: string | undefined;
  jobEndTimeEnd?: string | undefined;
  clusters?: string[] | undefined;
}

interface JobItem {
  idJob: number;
  biJobIndex: number;
  jobName: string;
  accountPrice?: Money
  [key: string]: any
}

const p = prefix("pageComp.tenant.adminJobTable.");
const pCommon = prefix("common.");

const filterFormToQuery = (query: FilterForm, rangeSearch: boolean): GetJobFilter => {
  return {
    userId: rangeSearch ? (query.userId || undefined) : undefined,
    accountName: rangeSearch ? (query.accountName || undefined) : undefined,
    jobEndTimeStart: rangeSearch ? (query.jobEndTime[0].toISOString()) : undefined,
    jobEndTimeEnd: rangeSearch ? (query.jobEndTime[1].toISOString()) : undefined,
    jobId:  !rangeSearch ? (query.jobId || undefined) : undefined,
    clusters: query.clusters?.map((x) => x.id),
  };
};

export const AdminJobTable: React.FC<Props> = () => {

  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;

  const { message } = App.useApp();

  const rangeSearch = useRef(true);
  const [currentDiffQuery, setCurrentDiffQuery] = useState<DiffQuery | undefined>(undefined);

  const { publicConfigClusters, clusterSortedIdList, activatedClusters } = useStore(ClusterInfoStore);
  const sortedClusters = getSortedClusterValues(publicConfigClusters, clusterSortedIdList)
    .filter((x) => Object.keys(activatedClusters).includes(x.id));


  const [query, setQuery] = useState<FilterForm>(() => {
    const now = dayjs();
    return {
      jobId: undefined,
      userId: "",
      accountName: "",
      jobEndTime: [now.subtract(1, "week").startOf("day"), now.endOf("day")],
      clusters: sortedClusters,
    };
  });
  const [form] = Form.useForm<FilterForm>();

  const [pageInfo, setPageInfo] = useState<PageInfo>({ page: 1, pageSize: DEFAULT_PAGE_SIZE });

  const promiseFn = useCallback(async () => {
    const diffQuery = filterFormToQuery(query, rangeSearch.current);
    setCurrentDiffQuery(diffQuery);
    return await api.getJobInfo({ query: {
      ...diffQuery,
      page: pageInfo.page,
      pageSize: pageInfo.pageSize,
    } });
  }, [pageInfo, query]);

  const { data, isLoading, reload } = useAsync({ promiseFn });

  const finalPriceText = {
    tenant: t(p("platformPrice")),
    account: t(p("tenantPrice")),
  };

  const handleExport = async (columns: string[], encoding: Encoding) => {
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
        columns,
        count: totalCount,
        timeZone, // 将浏览器时区作为参数传递到后端
        query: {
          ...currentDiffQuery,
          searchType: SearchType.TENANT,
          finalPriceText: JSON.stringify(finalPriceText),
          publicConfigClusters: JSON.stringify(publicConfigClusters),
        },
      });
    }
  };

  const exportOptions = useMemo(() => {
    return [
      { label: t(pCommon("clusterWorkId")), value: "idJob" },
      { label: t(pCommon("workName")), value: "jobName" },
      { label: t(pCommon("account")), value: "account" },
      { label: t(pCommon("user")), value: "user" },
      { label: t(pCommon("cluster")), value: "cluster" },
      { label: t(pCommon("partition")), value: "partition" },
      { label: "QOS", value: "qos" },
      { label: t(pCommon("timeSubmit")), value: "timeSubmit" },
      { label: t(pCommon("timeEnd")), value: "timeEnd" },
      { label: t(p("tenantPrice")), value: "accountPrice" },
      { label: t(p("platformPrice")), value: "tenantPrice" },
    ];
  }, [t]);

  return (
    <div>
      <FilterFormContainer>
        <Form<FilterForm>
          form={form}
          initialValues={query}
          onFinish={async () => {
            const currentQuery = await form.validateFields();
            setQuery(currentQuery);
            setPageInfo({ page: 1, pageSize: pageInfo.pageSize });
          }}
        >
          <FilterFormTabs
            button={(
              <Space>
                <Button type="primary" htmlType="submit">{t(pCommon("search"))}</Button>
                <ExportFileModaLButton
                  options={exportOptions} // 定义导出列选项
                  onExport={handleExport}
                >
                  {t(pCommon("export"))}
                </ExportFileModaLButton>
              </Space>
            )}
            onChange={(a) => rangeSearch.current = a === "range"}
            tabs={[
              {
                title: t(p("batch")), key: "range", node: (
                  <>
                    <Form.Item label={t(pCommon("cluster"))} name="clusters">
                      <ClusterSelector />
                    </Form.Item>
                    <Form.Item label={t(pCommon("userId"))} name="userId">
                      <Input />
                    </Form.Item>
                    <Form.Item label={t(pCommon("account"))} name="accountName">
                      <Input />
                    </Form.Item>
                    <Form.Item label={t(p("jobEndTime"))} name="jobEndTime">
                      <DatePicker.RangePicker showTime allowClear={false} presets={getDefaultPresets(languageId)} />
                    </Form.Item>
                  </>
                ),
              },
              {
                title: t(p("precise")), key: "precision", node: (
                  <>
                    <Form.Item label={t(pCommon("cluster"))} name="clusters">
                      <ClusterSelector />
                    </Form.Item>
                    <Form.Item label={t(pCommon("clusterWorkId"))} name="jobId">
                      <InputNumber min={1} style={{ minWidth: "160px" }} />
                    </Form.Item>
                  </>
                ),
              },
            ]}
          />
        </Form>
      </FilterFormContainer>
      <JobInfoTable
        target="account"
        reload={reload}
        data={data}
        isLoading={isLoading}
        pageInfo={pageInfo}
        setPageInfo={setPageInfo}
        filter={query}
        rangeSearch={rangeSearch.current}
      />
    </div>
  );
};




const ChangePriceButton: React.FC<{
  filter: GetJobFilter;
  count: number;
  target: "account" | "tenant";
  selectedJobs: JobItem[];
  reload: () => void;
  setOpen: (openFlag: boolean) => void;
  setSelectedJobs: (selectJobs: JobItem[]) => void,
  open: boolean;
}> = ({ filter, count, target, selectedJobs, open, reload, setOpen, setSelectedJobs }) => {

  const t = useI18nTranslateToString();

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={!(selectedJobs?.length > 0)}>
        {t(p("adjust"))}{target === "account" ? t(p("tenantPrice")) : t(p("platformPrice"))}
      </Button>
      <JobPriceChangeModal
        jobs={selectedJobs}
        target={target}
        reload={reload}
        onClose={() => setOpen(false)}
        open={open}
        setSelectedJobs={setSelectedJobs}
        filter={filter}
        jobCount={count}
      />
    </>
  );

};

interface JobInfoTableProps {
  data: Static<typeof GetJobInfoSchema["responses"]["200"]> | undefined;
  pageInfo: PageInfo;
  setPageInfo?: (info: PageInfo) => void;
  isLoading: boolean;
  filter: FilterForm;
  reload: () => void;
  target: "account" | "tenant";
  rangeSearch: boolean;
}




const JobInfoTable: React.FC<JobInfoTableProps> = ({
  data, pageInfo, setPageInfo, isLoading, filter, reload, target,
  rangeSearch,
}) => {

  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;
  const { publicConfigClusters } = useStore(ClusterInfoStore);

  const [previewItem, setPreviewItem] = useState<JobInfo | undefined>(undefined);
  const [selectedJobs, setSelectedJobs] = useState<JobItem[]>([]);
  const [open, setOpen] = useState(false);

  return (
    <>
      <TableTitle justify="space-between">
        {
          data ? (
            <div>
              <span>
                {t(p("jobNumber"))}<span>{data.totalCount}</span>
              </span>
              <Divider type="vertical" />
              <span>
                {t(p("tenantPriceSum"))}
                <span>{nullableMoneyToString(data.totalAccountPrice)} {t(pCommon("unit"))}</span>
              </span>
              <Divider type="vertical" />
              <span>
                {t(p("platformPriceSum"))}
                <span>{nullableMoneyToString(data.totalTenantPrice)} {t(pCommon("unit"))}</span>
              </span>
            </div>
          ) : undefined
        }
        <Space>
          <ChangePriceButton
            reload={reload}
            filter={useMemo(() => filterFormToQuery(filter, rangeSearch), [filter, rangeSearch])}
            count={data ? data.totalCount : 0}
            target={target}
            selectedJobs={selectedJobs}
            setSelectedJobs={setSelectedJobs}
            setOpen={setOpen}
            open={open}
          />
        </Space>
      </TableTitle>
      <Table
        rowKey={(i) => i.cluster + i.biJobIndex + i.idJob}
        dataSource={data?.jobs}
        loading={isLoading}
        pagination={setPageInfo ? {
          current: pageInfo.page,
          defaultPageSize: DEFAULT_PAGE_SIZE,
          pageSize: pageInfo.pageSize,
          showSizeChanger: true,
          total: data?.totalCount,
          onChange: (page, pageSize) => setPageInfo({ page, pageSize }),
        } : false}
        tableLayout="fixed"
        scroll={{ x: data?.jobs?.length ? 1800 : true }}
        rowSelection={{ type: "checkbox",
          onChange: (_, selectedRows) => {
            setSelectedJobs(selectedRows);
          },
          selectedRowKeys: selectedJobs?.map((i) => i.cluster + i.biJobIndex + i.idJob),
        }}

      >
        <Table.Column dataIndex="idJob" width="5.2%" title={t(pCommon("clusterWorkId"))} />
        <Table.Column dataIndex="jobName" ellipsis title={t(pCommon("workName"))} />
        <Table.Column dataIndex="user" ellipsis title={t(pCommon("userId"))} />
        <Table.Column dataIndex="account" ellipsis title={t(pCommon("account"))} />
        <Table.Column<JobInfo>
          dataIndex="cluster"
          ellipsis
          title={t(pCommon("cluster"))}
          render={(cluster) => getClusterName(cluster, languageId, publicConfigClusters)}
        />
        <Table.Column dataIndex="partition" width="6.7%" ellipsis title={t(pCommon("partition"))} />
        <Table.Column dataIndex="qos" width="6.7%" ellipsis title="QOS" />
        <Table.Column<JobInfo>
          dataIndex="timeSubmit"
          width="8.9%"
          title={t(pCommon("timeSubmit"))}
          render={(time: string) => formatDateTime(time)}
        />
        <Table.Column<JobInfo>
          dataIndex="timeEnd"
          width="8.9%"
          title={t(pCommon("timeEnd"))}
          render={(time: string) => formatDateTime(time)}
        />
        <Table.Column<JobInfo>
          dataIndex="accountPrice"
          width="6.1%"
          title={t(p("tenantPrice"))}
          render={(price: Money) => moneyToString(price)}
        />
        <Table.Column<JobInfo>
          dataIndex="tenantPrice"
          width="6.1%"
          title={t(p("platformPrice"))}
          render={(price: Money) => moneyToString(price)}
        />
        <Table.Column<JobInfo>
          title={t(pCommon("more"))}
          fixed="right"
          width="10%"
          render={(_, r) =>
            (
              <>
                <a
                  onClick={() => {
                    setOpen(true);
                    setSelectedJobs([r]);
                  }}
                  style={{ marginRight: 10 }}
                >{t(pCommon("adjustBill"))}</a>
                <a onClick={() => setPreviewItem(r)}>{t(pCommon("detail"))}</a>
              </>
            )
          }
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
