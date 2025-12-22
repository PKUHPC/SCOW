import { TableWrapper } from "@scow/lib-web/build/components/table/styleComponents";
import { compareNullableString } from "@scow/lib-web/build/utils/compareNullableValue";
import { useDidUpdateEffect } from "@scow/lib-web/build/utils/hooks";
import { compareTimeAsSeconds } from "@scow/lib-web/build/utils/math";
import { DEFAULT_PAGE_SIZE } from "@scow/lib-web/build/utils/pagination";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { Button, Form, Input, InputNumber, message, Popconfirm, Select, Space, Table, Tooltip } from "antd";
import { useRouter } from "next/router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { useAsync } from "react-async";
import { useStore } from "simstate";
import { api } from "src/apis";
import { DetailIcon, EndIcon, ModifyDeadlineIcon } from "src/assets/operationIcon";
import { SingleClusterSelector } from "src/components/ClusterSelector";
import { ClusterNotAvailablePage } from "src/components/errorPages/ClusterNotAvailablePage";
import { FilterFormContainer, FilterFormTabs } from "src/components/FilterFormContainer";
import { ModalLink } from "src/components/ModalLink";
import { TableTitle } from "src/components/TableTitle";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { runningJobId, RunningJobInfo } from "src/models/job";
import { statusColors } from "src/models/job";
import { BatchChangeJobTimeLimitButton } from "src/pageComponents/job/BatchChangeJobTimeLimitButton";
import { ChangeJobTimeLimitModal } from "src/pageComponents/job/ChangeJobTimeLimitModal";
import { RunningJobDrawer } from "src/pageComponents/job/RunningJobDrawer";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import type { Cluster } from "src/utils/cluster";
import { publicConfig } from "src/utils/config";
import { getAiExceptionJobI18nReason } from "src/utils/form";

interface FilterForm {
  jobId: number | undefined;
  cluster: Cluster;
  accountName?: string;
  userId?: string
}

interface Props {
  userId?: string;
  accountNames?: string[] | string;
  filterAccountName?: boolean;
  showAccount: boolean;
  showUser: boolean;
  showChangeTimeLimit?: boolean;
}


const p = prefix("pageComp.job.runningJobTable.");
const pCommon = prefix("common.");

export const RunningJobQueryTable: React.FC<Props> = ({
  userId, accountNames, showUser, showAccount, filterAccountName = true, showChangeTimeLimit = false,
}) => {

  const t = useI18nTranslateToString();

  const searchType = useRef<"precision" | "range">("range");

  const [selected, setSelected] = useState<RunningJobInfo[]>([]);

  const { activatedClusters, defaultCluster } = useStore(ClusterInfoStore);

  if (!defaultCluster && Object.keys(activatedClusters).length === 0) {
    return <ClusterNotAvailablePage />;
  }

  const [query, setQuery] = useState<FilterForm>(() => {
    return {
      accountName: typeof accountNames === "string" ? accountNames : undefined,
      jobId: undefined,
      cluster: defaultCluster ?? Object.values(activatedClusters)[0],
    };
  });

  useDidUpdateEffect(() => {
    setQuery((q) => ({
      ...q,
      accountName: Array.isArray(accountNames) ? accountNames[0] : accountNames ? accountNames : undefined,
    }));
  }, [accountNames]);

  const [form] = Form.useForm<FilterForm>();

  const promiseFn = useCallback(async () => {

    const diffAccountNameQuery = searchType.current === "precision" ? {
      accountName : Array.isArray(accountNames) ? undefined : accountNames,
    } : {
      accountName: query.accountName || undefined,
    };

    return await api.getRunningJobs({ query: {
      userId: userId || query.userId || undefined,
      cluster: query.cluster.id,
      ...diffAccountNameQuery,
    } });
  }, [userId, searchType.current, query.cluster, query.accountName, query.jobId,query.userId]);

  const { data, isLoading, reload } = useAsync({ promiseFn });

  const filteredData = useMemo(() => {
    if (!data) { return undefined; }

    let filtered = data.results;
    if (searchType.current === "precision" && query.jobId) {
      filtered = filtered.filter((x) => x.jobId === query.jobId + "");
    } else {
      // add local range filters here
    }

    return filtered.map((x) => RunningJobInfo.fromGrpc(x, activatedClusters[query.cluster.id]));
  }, [data, query.jobId]);

  return (
    <div>
      <FilterFormContainer>
        <Form
          form={form}
          initialValues={query}
          onFinish={async () => {
            setQuery({
              ...query,
              ...(await form.validateFields()),
            });
          }}
        >
          <FilterFormTabs
            onChange={(key: "range" | "precision") => {
              searchType.current = key;
            }}
            button={(
              <Space>
                <Button type="primary" htmlType="submit">{t(pCommon("search"))}</Button>
                <Button onClick={reload} loading={isLoading}>{t(pCommon("fresh"))}</Button>
              </Space>
            )}
            tabs={[
              {
                title: t(p("batch")),
                key: "range",
                node: (
                  <>
                    <Form.Item label={t(pCommon("cluster"))} name="cluster">
                      <SingleClusterSelector />
                    </Form.Item>
                    {
                      filterAccountName
                        ? accountNames
                          ? (
                            <Form.Item label={t(pCommon("account"))} name="accountName">
                              <Select style={{ minWidth: 96 }} allowClear>
                                {(Array.isArray(accountNames) ? accountNames : [accountNames]).map((x) => (
                                  <Select.Option key={x} value={x}>{x}</Select.Option>
                                ))}
                              </Select>
                            </Form.Item>
                          ) : (
                            <>
                              <Form.Item
                                label={t(pCommon("account"))}
                                name="accountName"
                                style={{ marginLeft:"0.5em" }}
                              >
                                <Input />
                              </Form.Item>
                              <Form.Item label={t(pCommon("userId"))} name="userId" style={{ marginLeft:"0.5em" }}>
                                <Input />
                              </Form.Item>
                            </>
                          )
                        : undefined
                    }
                  </>
                ),

              },
              {
                title: t(p("precision")),
                key: "precision",
                node: (
                  <>
                    <Form.Item label={t(pCommon("cluster"))} name="cluster">
                      <SingleClusterSelector />
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
      <RunningJobInfoTable
        data={filteredData}
        isLoading={isLoading}
        showAccount={showAccount}
        showUser={showUser}
        showCluster={false}
        showChangeTimeLimit={showChangeTimeLimit}
        reload={reload}
        selection={{
          selected, setSelected,
        }}
      />
    </div>
  );
};




interface JobInfoTableProps {
  data: RunningJobInfo[] | undefined;
  isLoading: boolean;
  showAccount: boolean;
  showCluster: boolean;
  showUser: boolean;
  showChangeTimeLimit?: boolean;
  reload: () => void;
  selection?: {
    selected: RunningJobInfo[];
    setSelected: (d: RunningJobInfo[]) => void;
  }
}

const ChangeJobTimeLimitModalLink = ModalLink(ChangeJobTimeLimitModal);

export const RunningJobInfoTable: React.FC<JobInfoTableProps> = ({
  data, isLoading, reload, showAccount, showUser, showCluster, selection,showChangeTimeLimit = false,
}) => {
  const router = useRouter();
  const [previewItem, setPreviewItem] = useState<RunningJobInfo | undefined>(undefined);

  // 租户页面或者用户账户管理员页面且用户账户管理员允许修改作业时限
  const changeJobLimitEnabled = showChangeTimeLimit || publicConfig.CHANGE_JOB_LIMIT.allowUserAndAccountAdmin;

  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;

  const renderOperation = useCallback((r: RunningJobInfo) => {
    if (router.pathname === "/user/runningJobs" || router.pathname === "/dashboard") {
      return (
        <Space size={16}>
          <Tooltip title={t(pCommon("detail"))}>
            <DetailIcon
              onClick={() => setPreviewItem(r)}
            />
          </Tooltip>
          {changeJobLimitEnabled && (
            <ChangeJobTimeLimitModalLink
              reload={reload}
              data={[r]}
            >
              <Tooltip title={t(p("changeLimit"))}>
                <ModifyDeadlineIcon />
              </Tooltip>
            </ChangeJobTimeLimitModalLink>
          )}
          <Popconfirm
            title={t(p("finishJobConfirm"))}
            onConfirm={async () =>
              api.cancelJob({
                query: {
                  cluster: r.cluster.id,
                  jobId: r.jobId,
                },
              }).then(() => {
                message.success(t(p("finishJobSuccess")));
                reload();
              })
            }
          >
            <Tooltip title={t(p("finishJobButton"))}>
              <EndIcon />
            </Tooltip>
          </Popconfirm>
        </Space>
      );
    }
    return (
      <Space size={16}>
        <a onClick={() => setPreviewItem(r)}>{t(pCommon("detail"))}</a>
        {changeJobLimitEnabled && (
          <ChangeJobTimeLimitModalLink
            reload={reload}
            data={[r]}
          >
            {t(p("changeLimit"))}
          </ChangeJobTimeLimitModalLink>
        )}
        <Popconfirm
          title={t(p("finishJobConfirm"))}
          onConfirm={async () =>
            api.cancelJob({
              query: {
                cluster: r.cluster.id,
                jobId: r.jobId,
              },
            }).then(() => {
              message.success(t(p("finishJobSuccess")));
              reload();
            })
          }
        >
          <a>{t(p("finishJobButton"))}</a>
        </Popconfirm>
      </Space>
    );
  }, [t]);

  return (
    <>
      {selection ? (
        <TableTitle>
          <Space>
            {changeJobLimitEnabled && (
              <BatchChangeJobTimeLimitButton
                data={selection.selected}
                disabled={isLoading || selection.selected.length === 0}
                reload={reload}
              />
            )}
          </Space>
        </TableTitle>
      ) : undefined}
      <TableWrapper>
        <Table
          {...(selection ? {
            rowSelection: {
              type: "checkbox",
              selectedRowKeys: selection.selected.map(runningJobId),
              onChange: (_selectedRowKeys: React.Key[], selectedRows: RunningJobInfo[]) => {
                selection.setSelected(selectedRows);
              },
              getCheckboxProps: (record: RunningJobInfo) => ({
                name: record.name,
              }),
            },
          } : {})}
          dataSource={data}
          loading={isLoading}
          pagination={{
            showSizeChanger: true,
            defaultPageSize: DEFAULT_PAGE_SIZE,
          }}
          rowKey={runningJobId}
          scroll={{ x: data?.length ? 2000 : true }}
          tableLayout="fixed"
        >
          {
            showCluster && (
              <Table.Column<RunningJobInfo>
                dataIndex="cluster"
                width="9.5%"
                title={t(pCommon("cluster"))}
                render={(_, r) => getI18nConfigCurrentText(r.cluster.name, languageId)}
                sorter={(a, b) => {
                  const clusterA = getI18nConfigCurrentText(a.cluster.name, languageId);
                  const clusterB = getI18nConfigCurrentText(b.cluster.name, languageId);
                  return compareNullableString(clusterA, clusterB);
                }}
              />
            )
          }
          <Table.Column<RunningJobInfo>
            dataIndex="jobId"
            width="5%"
            title={t(pCommon("workId"))}
            sorter={(a, b) => (isNaN(Number(a.jobId)) || isNaN(Number(b.jobId))) ?
              a.jobId.localeCompare(b.jobId) : Number(a.jobId) - Number(b.jobId)}
          />
          <Table.Column<RunningJobInfo>
            dataIndex="name"
            ellipsis
            title={t(pCommon("workName"))}
            sorter={(a, b) => a.name.localeCompare(b.name)}
          />
          {
            showUser && (
              <Table.Column<RunningJobInfo>
                dataIndex="user"
                width="8%"
                ellipsis
                title={t(pCommon("userId"))}
                sorter={(a, b) => a.user.localeCompare(b.user)}
              />
            )
          }
          {
            showAccount && (
              <Table.Column<RunningJobInfo>
                dataIndex="account"
                width="9.5%"
                ellipsis
                title={t(pCommon("account"))}
                sorter={(a, b) => a.account.localeCompare(b.account)}
              />
            )
          }
          <Table.Column<RunningJobInfo>
            dataIndex="partition"
            width="6.3%"
            ellipsis
            title={t(pCommon("partition"))}
            sorter={(a, b) => a.partition.localeCompare(b.partition)}
          />
          <Table.Column<RunningJobInfo>
            dataIndex="qos"
            width="6.3%"
            ellipsis
            title="QOS"
            sorter={(a, b) => (isNaN(Number(a.qos)) || isNaN(Number(b.qos))) ?
              a.qos.localeCompare(b.qos) : Number(a.qos) - Number(b.qos)}
          />
          <Table.Column<RunningJobInfo>
            dataIndex="nodes"
            width="5%"
            ellipsis
            title={t(p("nodes"))}
            sorter={(a, b) => (isNaN(Number(a.nodes)) || isNaN(Number(b.nodes))) ?
              a.nodes.localeCompare(b.nodes) : Number(a.nodes) - Number(b.nodes)}
          />
          <Table.Column<RunningJobInfo>
            dataIndex="cores"
            width="5%"
            ellipsis
            title={t(p("cores"))}
            sorter={(a, b) => (isNaN(Number(a.cores)) || isNaN(Number(b.cores))) ?
              a.cores.localeCompare(b.cores) : Number(a.cores) - Number(b.cores)}
          />
          <Table.Column<RunningJobInfo>
            dataIndex="gpus"
            width="6%"
            ellipsis
            title={t(p("gpus"))}
            sorter={(a, b) => (isNaN(Number(a.gpus)) || isNaN(Number(b.gpus))) ?
              a.gpus.localeCompare(b.gpus) : Number(a.gpus) - Number(b.gpus)}
          />
          <Table.Column<RunningJobInfo>
            dataIndex="state"
            width="6%"
            title={t(pCommon("status"))}
            sorter={(a, b) => a.state.localeCompare(b.state)}
            render={(text: string): React.ReactNode => {
              const color = statusColors[text.toUpperCase()];
              return <span style={{ color }}>{text}</span>;
            }}
          />
          <Table.Column<RunningJobInfo>
            dataIndex="runningOrQueueTime"
            width="8%"
            ellipsis
            title={t(p("time"))}
            sorter={(a, b) => compareTimeAsSeconds(a.runningOrQueueTime, b.runningOrQueueTime)}
          />
          <Table.Column<RunningJobInfo>
            dataIndex="reason"
            ellipsis={true}
            title={t(p("reason"))}
            render={(d: string) => {
              const displayedValue = d.startsWith("(") && d.endsWith(")") ? d.substring(1, d.length - 1) : d;
              return getAiExceptionJobI18nReason(displayedValue, t);
            }}
            sorter={(a, b) => (a.reason ?? "").localeCompare(b.reason ?? "")}
          />
          <Table.Column<RunningJobInfo>
            dataIndex="timeLimit"
            width="6.5%"
            title={t(p("limit"))}
            sorter={(a, b) => compareTimeAsSeconds(a.timeLimit, b.timeLimit)}
          />

          <Table.Column<RunningJobInfo>
            title={t(pCommon("operation"))}
            width={router.pathname === "/user/runningJobs" || router.pathname === "/dashboard" ? "8%" : "12%"}
            fixed="right"
            render={(_, r) => {
              return renderOperation(r);
            }}
          />
        </Table>
      </TableWrapper>
      <RunningJobDrawer
        open={previewItem !== undefined}
        item={previewItem}
        onClose={() => setPreviewItem(undefined)}
      />
    </>
  );
};

