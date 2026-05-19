import { TableWrapper } from "@scow/lib-web/build/components/table/styleComponents";
import { compareTimeAsSeconds } from "@scow/lib-web/build/utils/math";
import { DEFAULT_PAGE_SIZE } from "@scow/lib-web/build/utils/pagination";
import { App, Button, Form, InputNumber, Popconfirm, Space, Table, Tooltip } from "antd";
import Router from "next/router";
import { join } from "path";
import React, { useCallback, useMemo, useState } from "react";
import { useAsync } from "react-async";
import { useStore } from "simstate";
import { api } from "src/apis";
import { SingleClusterSelector } from "src/components/ClusterSelector";
import { ClusterNotAvailablePage } from "src/components/errorPages/ClusterNotAvailablePage";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { DetailIcon, EndIcon, EnterDirectoryIcon } from "src/icons/operationIcon";
import { runningJobId, RunningJobInfo } from "src/models/job";
import { statusColors } from "src/models/job";
import { JobDrawer } from "src/pageComponents/job/JobDrawer";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { Cluster } from "src/utils/cluster";

interface FilterForm {
  jobId: number | undefined;
  cluster: Cluster;
}

interface Props {
  userId: string;
}

const p = prefix("pageComp.job.runningJobTable.");

export const RunningJobQueryTable: React.FC<Props> = ({ userId }) => {
  const { currentClusters, defaultCluster, activatedClusters } = useStore(ClusterInfoStore);

  if (!defaultCluster && currentClusters.length === 0) {
    return <ClusterNotAvailablePage />;
  }

  const [query, setQuery] = useState<FilterForm>(() => {
    return {
      jobId: undefined,
      cluster: defaultCluster ?? currentClusters[0],
    };
  });

  const [form] = Form.useForm<FilterForm>();

  const promiseFn = useCallback(async () => {
    return await api.getRunningJobs({
      query: {
        userId: userId,
        cluster: query.cluster.id,
      },
    });
  }, [userId, query.cluster]);

  const { data, isLoading, reload } = useAsync({ promiseFn });

  const filteredData = useMemo(() => {
    if (!data) {
      return undefined;
    }

    let filtered = data.results;
    if (query.jobId) {
      filtered = filtered.filter((x) => x.jobId === query.jobId + "");
    }

    return filtered.map((x) => RunningJobInfo.fromGrpc(x, query.cluster));
  }, [data, query.jobId]);

  const t = useI18nTranslateToString();

  return (
    <div>
      <FilterFormContainer>
        <Form<FilterForm>
          layout="inline"
          form={form}
          initialValues={query}
          onFinish={async () => {
            setQuery({
              ...(await form.validateFields()),
            });
          }}
        >
          <Form.Item label={t(p("filterForm.cluster"))} name="cluster">
            <SingleClusterSelector clusterIds={activatedClusters.map((x) => x.id)} />
          </Form.Item>
          <Form.Item label={t(p("filterForm.jobId"))} name="jobId">
            <InputNumber style={{ minWidth: "160px" }} min={1} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              {t("button.searchButton")}
            </Button>
          </Form.Item>
          <Form.Item>
            <Button loading={isLoading} onClick={reload}>
              {t("button.refreshButton")}
            </Button>
          </Form.Item>
        </Form>
      </FilterFormContainer>
      <RunningJobInfoTable data={filteredData} isLoading={isLoading} reload={reload} />
    </div>
  );
};

interface JobInfoTableProps {
  data: RunningJobInfo[] | undefined;
  isLoading: boolean;
  reload: () => void;
}

export const RunningJobInfoTable: React.FC<JobInfoTableProps> = ({ data, isLoading, reload }) => {
  const { message } = App.useApp();
  const t = useI18nTranslateToString();

  const [previewItem, setPreviewItem] = useState<RunningJobInfo | undefined>(undefined);

  return (
    <>
      <TableWrapper>
        <Table
          tableLayout="fixed"
          dataSource={data}
          loading={isLoading}
          pagination={{
            showSizeChanger: true,
            defaultPageSize: DEFAULT_PAGE_SIZE,
          }}
          rowKey={runningJobId}
          scroll={{ x: data?.length ? 1800 : true }}
        >
          <Table.Column<RunningJobInfo>
            dataIndex="jobId"
            width="5.2%"
            title={t(p("jobInfoTable.jobId"))}
            sorter={(a, b) =>
              isNaN(Number(a.jobId)) || isNaN(Number(b.jobId))
                ? a.jobId.localeCompare(b.jobId)
                : Number(a.jobId) - Number(b.jobId)
            }
          />
          <Table.Column<RunningJobInfo>
            dataIndex="name"
            ellipsis
            title={t(p("jobInfoTable.name"))}
            sorter={(a, b) => a.name.localeCompare(b.name)}
          />
          <Table.Column<RunningJobInfo>
            dataIndex="account"
            width="10%"
            ellipsis
            title={t(p("jobInfoTable.account"))}
            sorter={(a, b) => a.account.localeCompare(b.account)}
          />

          <Table.Column<RunningJobInfo>
            dataIndex="partition"
            width="6.7%"
            ellipsis
            title={t(p("jobInfoTable.partition"))}
            sorter={(a, b) => a.partition.localeCompare(b.partition)}
          />
          <Table.Column<RunningJobInfo>
            dataIndex="qos"
            width="6.7%"
            ellipsis
            title={t(p("jobInfoTable.qos"))}
            sorter={(a, b) =>
              isNaN(Number(a.qos)) || isNaN(Number(b.qos)) ? a.qos.localeCompare(b.qos) : Number(a.qos) - Number(b.qos)
            }
          />
          <Table.Column<RunningJobInfo>
            dataIndex="nodes"
            width="4.5%"
            title={t(p("jobInfoTable.nodes"))}
            sorter={(a, b) =>
              isNaN(Number(a.nodes)) || isNaN(Number(b.nodes))
                ? a.nodes.localeCompare(b.nodes)
                : Number(a.nodes) - Number(b.nodes)
            }
          />
          <Table.Column<RunningJobInfo>
            dataIndex="cores"
            width="4.5%"
            title={t(p("jobInfoTable.cores"))}
            sorter={(a, b) =>
              isNaN(Number(a.cores)) || isNaN(Number(b.cores))
                ? a.cores.localeCompare(b.cores)
                : Number(a.cores) - Number(b.cores)
            }
          />
          <Table.Column<RunningJobInfo>
            dataIndex="gpus"
            width="7%"
            ellipsis
            title={t(p("jobInfoTable.gpus"))}
            sorter={(a, b) =>
              isNaN(Number(a.gpus)) || isNaN(Number(b.gpus))
                ? a.gpus.localeCompare(b.gpus)
                : Number(a.gpus) - Number(b.gpus)
            }
          />
          <Table.Column<RunningJobInfo>
            dataIndex="state"
            width="6.1%"
            title={t(p("jobInfoTable.state"))}
            sorter={(a, b) => a.state.localeCompare(b.state)}
            render={(text: string): React.ReactNode => {
              const color = statusColors[text.toUpperCase()];
              return <span style={{ color }}>{text}</span>;
            }}
          />
          <Table.Column<RunningJobInfo>
            dataIndex="runningOrQueueTime"
            width="9%"
            ellipsis
            title={t(p("jobInfoTable.runningOrQueueTime"))}
            sorter={(a, b) => compareTimeAsSeconds(a.runningOrQueueTime, b.runningOrQueueTime, ":")}
          />
          <Table.Column<RunningJobInfo>
            dataIndex="reason"
            ellipsis
            title={t(p("jobInfoTable.reason"))}
            sorter={(a, b) => (a.reason ?? "").localeCompare(b.reason ?? "")}
          />
          <Table.Column<RunningJobInfo>
            dataIndex="timeLimit"
            width="6.7%"
            title={t(p("jobInfoTable.timeLimit"))}
            sorter={(a, b) => compareTimeAsSeconds(a.timeLimit, b.timeLimit, ":")}
          />
          <Table.Column<RunningJobInfo>
            title={t(p("jobInfoTable.operation"))}
            width="8%"
            fixed="right"
            render={(_, r) => (
              <Space size={8} style={{ marginLeft: 5 }}>
                <Tooltip title={t("button.detailButton")}>
                  <DetailIcon onClick={() => setPreviewItem(r)} />
                </Tooltip>
                <Tooltip title={t(p("jobInfoTable.linkToPath"))}>
                  <EnterDirectoryIcon onClick={() => Router.push(join("/files", r.cluster.id, r.workingDir))} />
                </Tooltip>
                <Popconfirm
                  title={t(p("jobInfoTable.popConfirm"))}
                  onConfirm={async () =>
                    api
                      .cancelJob({
                        query: {
                          cluster: r.cluster.id,
                          jobId: +r.jobId,
                        },
                      })
                      .then(() => {
                        message.success(t(p("jobInfoTable.successMessage")));
                        reload();
                      })
                  }
                >
                  <Tooltip title={t("button.finishButton")}>
                    <EndIcon />
                  </Tooltip>
                </Popconfirm>
              </Space>
            )}
          />
        </Table>
      </TableWrapper>
      <JobDrawer open={previewItem !== undefined} item={previewItem} onClose={() => setPreviewItem(undefined)} />
    </>
  );
};
