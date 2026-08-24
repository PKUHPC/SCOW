import { SYSTEM_VALID_LANGUAGES } from "@scow/config/build/i18n";
import { compareNullableDateTime } from "@scow/lib-web/build/utils/compareNullableValue";
import { formatDateTime } from "@scow/lib-web/build/utils/datetime";
import { DEFAULT_PAGE_SIZE } from "@scow/lib-web/build/utils/pagination";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { JobInfo } from "@scow/protos/build/portal/job";
import { type JobState, jobStates } from "@scow/utils";
import { App, Button, ConfigProvider, Form, Input, Popconfirm, Select, Space, Table, Tooltip } from "antd";
import { SortOrder } from "antd/es/table/interface";
import Router from "next/router";
import { join } from "path";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { useAsync } from "react-async";
import { useStore } from "simstate";
import { api } from "src/apis";
import { SingleClusterSelector } from "src/components/ClusterSelector";
import { ClusterNotAvailablePage } from "src/components/errorPages/ClusterNotAvailablePage";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { DetailIcon, EndIcon, EnterDirectoryIcon } from "src/icons/operationIcon";
import { statusColors } from "src/models/job";
import {
  AllJobsTimeFilter,
  AllJobsTimeRange,
  AllJobsTimeType,
  getDefaultAllJobsTimeRange,
} from "src/pageComponents/job/AllJobsTimeFilter";
import { JobDrawer } from "src/pageComponents/job/JobDrawer";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { Cluster } from "src/utils/cluster";

type KeywordType = "jobId" | "jobName";

const unfinishedRank = (state: string) => (state === "PENDING" || state === "RUNNING" ? 0 : 1);

const compareJobs = (a: JobInfo, b: JobInfo) => {
  const rankDiff = unfinishedRank(a.state) - unfinishedRank(b.state);
  if (rankDiff !== 0) return rankDiff;

  return b.jobId - a.jobId;
};

interface FilterForm {
  time: AllJobsTimeRange;
  cluster: Cluster;
  keywordType: KeywordType;
  keyword?: string;
  account?: string;
  state: "ALL" | JobState;
  timeType: AllJobsTimeType;
}

interface Props {
  userId: string;
}

interface SortInfo {
  field: string | null | undefined;
  order: SortOrder;
}

export const AllJobQueryTable: React.FC<Props> = ({ userId }) => {
  const { currentClusters, defaultCluster, activatedClusters } = useStore(ClusterInfoStore);

  if (!defaultCluster && currentClusters.length === 0) {
    return <ClusterNotAvailablePage />;
  }

  const [query, setQuery] = useState<FilterForm>(() => {
    return {
      time: getDefaultAllJobsTimeRange(),
      cluster: defaultCluster ?? currentClusters[0],
      keywordType: "jobId",
      state: "ALL",
      timeType: "submitTime",
    };
  });
  const [form] = Form.useForm<FilterForm>();
  const draftTimeRangeRef = useRef(query.time);
  const handleDraftTimeRangeChange = useCallback((timeRange: AllJobsTimeRange) => {
    draftTimeRangeRef.current = timeRange;
  }, []);
  const [currentPageNum, setCurrentPageNum] = useState<number>(1);
  const [currentSortInfo, setCurrentSortInfo] = useState<SortInfo>({ field: null, order: null });

  const promiseFn = useCallback(async () => {
    const requestedCluster = query.cluster;
    const keyword = query.keyword?.trim();
    const result = await api.getAllJobs({
      query: {
        cluster: requestedCluster.id,
        startTime: query.time[0].toISOString(),
        endTime: query.time[1].toISOString(),
        jobId: query.keywordType === "jobId" && keyword ? Number(keyword) : undefined,
        jobName: query.keywordType === "jobName" ? keyword || undefined : undefined,
        account: query.account?.trim() || undefined,
        state: query.state,
        timeType: query.timeType,
      },
    });

    return { ...result, cluster: requestedCluster };
  }, [userId, query]);

  const { data, error, isLoading, reload } = useAsync({ promiseFn });

  const tableData = useMemo(
    () =>
      isLoading || error
        ? undefined
        : data?.results.map((job) => ({ ...job, cluster: data.cluster })).sort(compareJobs),
    [data, error, isLoading],
  );

  const t = useI18nTranslateToString();
  const p = prefix("pageComp.job.allJobsTable.searchForm.");
  const languageId = useI18n().currentLanguage.id;
  const filterTypeSelectWidth = languageId === SYSTEM_VALID_LANGUAGES.ZH_CN ? 100 : 130;

  return (
    <div>
      <FilterFormContainer>
        <Form<FilterForm>
          layout="inline"
          form={form}
          initialValues={query}
          onFinish={(values) => {
            const time = draftTimeRangeRef.current;
            form.setFieldValue("time", time);
            // 每次提交都创建新对象，保证相同条件重复搜索时也会重新请求。
            setQuery({ ...values, time });
            setCurrentPageNum(1);
            setCurrentSortInfo({ field: null, order: null });
          }}
        >
          <Form.Item label={t(p("clusterLabel"))} name="cluster">
            <SingleClusterSelector clusterIds={activatedClusters.map((x) => x.id)} />
          </Form.Item>
          <Form.Item>
            <Space.Compact>
              <Form.Item name="keywordType" noStyle>
                <Select
                  style={{ width: filterTypeSelectWidth }}
                  options={[
                    { value: "jobId", label: t(p("jobId")) },
                    { value: "jobName", label: t(p("jobName")) },
                  ]}
                />
              </Form.Item>
              <Form.Item
                name="keyword"
                dependencies={["keywordType"]}
                noStyle
                rules={[
                  {
                    validator: (_, value?: string) => {
                      const normalizedValue = value?.trim() ?? "";
                      if (form.getFieldValue("keywordType") !== "jobId" || normalizedValue === "") {
                        return Promise.resolve();
                      }

                      const jobId = Number(normalizedValue);
                      const isValidJobId =
                        Number.isSafeInteger(jobId) &&
                        jobId > 0 &&
                        jobId <= 0xffffffff &&
                        String(jobId) === normalizedValue;

                      return isValidJobId ? Promise.resolve() : Promise.reject(new Error(t(p("invalidJobId"))));
                    },
                  },
                ]}
              >
                <Input allowClear style={{ width: 125 }} />
              </Form.Item>
            </Space.Compact>
          </Form.Item>
          <Form.Item label={t(p("account"))} name="account">
            <Input allowClear style={{ width: 160 }} />
          </Form.Item>
          <Form.Item label={t(p("state"))} name="state">
            <Select
              style={{ width: 140 }}
              options={[
                { value: "ALL", label: t(p("allStates")) },
                ...jobStates.map((state) => ({ value: state, label: state })),
              ]}
            />
          </Form.Item>
          <Form.Item name="time" noStyle>
            <AllJobsTimeFilter
              timeTypeSelectWidth={filterTypeSelectWidth}
              languageId={languageId}
              onDraftChange={handleDraftTimeRangeChange}
            />
          </Form.Item>
          <Form.Item style={{ marginInlineStart: "auto" }}>
            <ConfigProvider wave={{ disabled: true }}>
              <Button type="primary" htmlType="submit" loading={isLoading} style={{ boxShadow: "none" }}>
                {t("button.searchButton")}
              </Button>
            </ConfigProvider>
          </Form.Item>
        </Form>
      </FilterFormContainer>
      <JobInfoTable
        data={tableData}
        isLoading={isLoading}
        reload={reload}
        cluster={data?.cluster ?? query.cluster}
        currentSortInfo={currentSortInfo}
        onSortChange={setCurrentSortInfo}
        currentPageNum={currentPageNum}
        onPageChange={setCurrentPageNum}
      />
    </div>
  );
};

interface JobInfoTableProps {
  data: JobInfo[] | undefined;
  isLoading: boolean;
  reload: () => void;
  cluster: Cluster;
  currentSortInfo: SortInfo;
  onSortChange: (sortInfo: SortInfo) => void;
  currentPageNum: number;
  onPageChange: (page: number) => void;
}

export const JobInfoTable: React.FC<JobInfoTableProps> = ({
  data,
  isLoading,
  reload,
  cluster,
  currentSortInfo,
  onSortChange,
  currentPageNum,
  onPageChange,
}) => {
  const [previewItem, setPreviewItem] = useState<JobInfo | undefined>(undefined);

  const { message } = App.useApp();
  const languageId = useI18n().currentLanguage.id;
  const t = useI18nTranslateToString();
  const p = prefix("pageComp.job.allJobsTable.tableInfo.");
  const clusterName = getI18nConfigCurrentText(cluster.name, languageId) || cluster.id;

  return (
    <>
      <Table
        dataSource={data}
        loading={isLoading}
        pagination={{
          showSizeChanger: true,
          defaultPageSize: DEFAULT_PAGE_SIZE,
          current: currentPageNum,
          onChange: onPageChange,
        }}
        rowKey={(x) => x.jobId}
        scroll={{ x: data?.length ? 1600 : true }}
        onChange={(_, __, sortInfo) => {
          const currentSorter = Array.isArray(sortInfo) ? sortInfo[0] : sortInfo;
          onSortChange({
            field: typeof currentSorter?.field === "string" ? currentSorter.field : null,
            order: currentSorter?.order ?? null,
          });
        }}
      >
        <Table.Column<JobInfo> dataIndex="jobId" width="8%" title={t(p("jobId"))} />
        <Table.Column<JobInfo> dataIndex="name" width="12%" ellipsis title={t(p("jobName"))} />
        <Table.Column<JobInfo> width="10%" ellipsis title={t(p("cluster"))} render={() => clusterName} />
        <Table.Column<JobInfo> dataIndex="account" width="10%" ellipsis title={t(p("account"))} />
        <Table.Column<JobInfo> dataIndex="partition" width="9%" ellipsis title={t(p("partition"))} />
        <Table.Column<JobInfo>
          dataIndex="state"
          width="9%"
          title={t(p("state"))}
          render={(text: string): React.ReactNode => {
            const color = statusColors[text.toUpperCase()];
            return <span style={{ color }}>{text}</span>;
          }}
        />
        <Table.Column<JobInfo>
          dataIndex="submitTime"
          width="13%"
          title={t(p("submitTime"))}
          render={(t) => formatDateTime(t)}
          sorter={(a, b) => compareNullableDateTime(a.submitTime, b.submitTime)}
          sortOrder={currentSortInfo.field === "submitTime" ? currentSortInfo.order : null}
        />
        <Table.Column<JobInfo>
          dataIndex="endTime"
          width="13%"
          title={t(p("endTime"))}
          render={(t) => (t ? formatDateTime(t) : "-")}
          sorter={(a, b) => compareNullableDateTime(a.endTime, b.endTime)}
          sortOrder={currentSortInfo.field === "endTime" ? currentSortInfo.order : null}
        />
        <Table.Column<JobInfo> dataIndex="elapsed" width="8%" title={t(p("elapsed"))} />
        <Table.Column<JobInfo>
          title={t(p("operation"))}
          width="8%"
          fixed="right"
          render={(_, r) => (
            <Space>
              <Tooltip title={t("button.detailButton")}>
                <DetailIcon onClick={() => setPreviewItem(r)} />
              </Tooltip>
              <Tooltip title={t(p("linkToPath"))}>
                <EnterDirectoryIcon onClick={() => Router.push(join("/files", cluster.id, r.workingDirectory))} />
              </Tooltip>
              {(r.state === "RUNNING" || r.state === "PENDING") && (
                <Popconfirm
                  title={t(p("popConfirm"))}
                  onConfirm={async () =>
                    api
                      .cancelJob({
                        query: {
                          cluster: cluster.id,
                          jobId: +r.jobId,
                        },
                      })
                      .then(() => {
                        message.success(t(p("successMessage")));
                        reload();
                      })
                  }
                >
                  <Tooltip title={t("button.finishButton")}>
                    <EndIcon />
                  </Tooltip>
                </Popconfirm>
              )}
            </Space>
          )}
        />
      </Table>
      <JobDrawer open={previewItem !== undefined} item={previewItem} onClose={() => setPreviewItem(undefined)} />
    </>
  );
};
