import { Button, Form, Input, InputNumber, Select, Space, Table } from "antd";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { useAsync } from "react-async";
import { api } from "src/apis";
import { SingleClusterSelector } from "src/components/ClusterSelector";
import { FilterFormContainer, FilterFormTabs } from "src/components/FilterFormContainer";
import { ModalLink } from "src/components/ModalLink";
import { TableTitle } from "src/components/TableTitle";
import { runningJobId, RunningJobInfo } from "src/models/job";
import { BatchChangeJobTimeLimitButton } from "src/pageComponents/job/BatchChangeJobTimeLimitButton";
import { ChangeJobTimeLimitModal } from "src/pageComponents/job/ChangeJobTimeLimitModal";
import { RunningJobDrawer } from "src/pageComponents/job/RunningJobDrawer";
import type { Cluster } from "src/utils/config";
import { CLUSTERS } from "src/utils/config";
import { useDidUpdateEffect } from "src/utils/hooks";

interface FilterForm {
  jobId: number | undefined;
  cluster: Cluster;
  accountName?: string;
}

interface Props {
  userId?: string;
  accountNames?: string[] | string;
  filterAccountName?: boolean;
  showAccount: boolean;
  showUser: boolean;
}

const clustersIdMap = CLUSTERS.reduce((prev, curr) => {
  prev[curr.id] = curr;
  return prev;
}, {} as Record<string, Cluster>);


export const RunningJobQueryTable: React.FC<Props> = ({
  userId, accountNames, showUser, showAccount, filterAccountName = true,
}) => {

  const searchType = useRef<"precision" | "range">("range");

  const [selected, setSelected] = useState<RunningJobInfo[]>([]);

  const [query, setQuery] = useState<FilterForm>(() => {
    return {
      accountName: typeof accountNames === "string" ? accountNames : undefined,
      jobId: undefined,
      cluster: CLUSTERS[0],
    };
  });

  useDidUpdateEffect(() => {
    setQuery((q) => ({ ...q, accountName: accountNames ? accountNames[0] : undefined }));
  }, [accountNames]);

  const [form] = Form.useForm<FilterForm>();

  const promiseFn = useCallback(async () => {
    return await api.getRunningJobs({ query: {
      userId: userId || undefined,
      cluster: query.cluster.id,
      accountName: searchType.current === "precision" ? undefined : (query.accountName || undefined),
    } });
  }, [userId, searchType.current, query.cluster, query.accountName, query.jobId]);

  const { data, isLoading, reload } = useAsync({ promiseFn });

  const filteredData = useMemo(() => {
    if (!data) { return undefined;}

    let filtered = data.results;
    if (searchType.current === "precision") {
      filtered = filtered.filter((x) => x.jobId === query.jobId + "");
    } else {
      // add local range filters here
    }

    return filtered.map((x) => RunningJobInfo.fromGrpc(x, clustersIdMap[query.cluster.id]));
  }, [data, query.jobId]);

  return (
    <div>
      <FilterFormContainer>
        <Form<FilterForm> form={form} initialValues={query}
          onFinish={async () => {
            setQuery({
              accountName: query.accountName,
              ...await form.validateFields(),
            });
          }}
        >
          <FilterFormTabs
            onChange={(key: "range" | "precision") => {
              searchType.current = key;
            }}
            button={
              <Space>
                <Button type="primary" htmlType="submit">??????</Button>
                <Button onClick={reload} disabled={isLoading}>??????</Button>
              </Space>
            } tabs={[
              {
                title: "????????????",
                key: "range",
                node: (
                  <>
                    <Form.Item label="??????" name="cluster">
                      <SingleClusterSelector />
                    </Form.Item>
                    {
                      filterAccountName
                        ? accountNames
                          ? (
                            <Form.Item label="??????" name="accountName">
                              <Select style={{ minWidth: 96 }} allowClear>
                                {(Array.isArray(accountNames) ? accountNames : [accountNames]).map((x) => (
                                  <Select.Option key={x} value={x}>{x}</Select.Option>
                                ))}
                              </Select>
                            </Form.Item>
                          ) : (
                            <Form.Item label="??????" name="accountName">
                              <Input />
                            </Form.Item>
                          )
                        : undefined
                    }
                  </>
                ),

              },
              {
                title: "????????????",
                key: "precision",
                node: (
                  <>
                    <Form.Item label="??????" name="cluster">
                      <SingleClusterSelector />
                    </Form.Item>
                    <Form.Item label="????????????ID" name="jobId">
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
        reload={reload}
        selection={{
          selected, setSelected,
        }}
      />
    </div>
  );
};




type JobInfoTableProps = {
  data: RunningJobInfo[] | undefined;
  isLoading: boolean;
  showAccount: boolean;
  showCluster: boolean;
  showUser: boolean;
  reload: () => void;
  selection?: {
    selected: RunningJobInfo[];
    setSelected: (d: RunningJobInfo[]) => void;
  }
};

const ChangeJobTimeLimitModalLink = ModalLink(ChangeJobTimeLimitModal);

export const RunningJobInfoTable: React.FC<JobInfoTableProps> = ({
  data,  isLoading, reload, showAccount, showCluster, showUser, selection,
}) => {

  const [previewItem, setPreviewItem] = useState<RunningJobInfo | undefined>(undefined);

  return (
    <>
      {selection ? (
        <TableTitle>
          <Space>
            <BatchChangeJobTimeLimitButton
              data={selection.selected}
              disabled={isLoading || selection.selected.length === 0}
              reload={reload}
            />
          </Space>
        </TableTitle>
      ) : undefined}
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
        pagination={{ showSizeChanger: true }}
        rowKey={runningJobId}
        scroll={{ x: true }}
      >
        {
          showCluster && (
            <Table.Column<RunningJobInfo> dataIndex="cluster" title="??????"
              render={(_, r) => r.cluster.name}
            />
          )
        }
        <Table.Column<RunningJobInfo> dataIndex="jobId" title="??????ID" />
        {
          showUser && (
            <Table.Column<RunningJobInfo> dataIndex="user" title="??????" />
          )
        }
        {
          showAccount && (
            <Table.Column<RunningJobInfo> dataIndex="account" title="??????" />
          )
        }
        <Table.Column<RunningJobInfo> dataIndex="name" title="?????????" />
        <Table.Column<RunningJobInfo> dataIndex="partition" title="??????" />
        <Table.Column<RunningJobInfo> dataIndex="qos" title="QOS" />
        <Table.Column<RunningJobInfo> dataIndex="nodes" title="?????????" />
        <Table.Column<RunningJobInfo> dataIndex="cores" title="?????????" />
        <Table.Column<RunningJobInfo> dataIndex="state" title="??????" />
        <Table.Column<RunningJobInfo> dataIndex="runningOrQueueTime"
          title="??????/????????????"
        />
        <Table.Column<RunningJobInfo> dataIndex="nodesOrReason" title="??????"
          render={(d: string) => d.startsWith("(") && d.endsWith(")") ? d.substring(1, d.length - 1) : d}
        />
        <Table.Column<RunningJobInfo> dataIndex="timeLimit" title="??????????????????" />

        <Table.Column<RunningJobInfo> title="??????"
          render={(_, r) => (
            <Space>
              <a onClick={() => setPreviewItem(r)}>??????</a>
              <ChangeJobTimeLimitModalLink
                reload={reload}
                data={[r]}
              >
                ??????????????????
              </ChangeJobTimeLimitModalLink>
            </Space>
          )}
        />
      </Table>
      <RunningJobDrawer show={previewItem !== undefined}
        item={previewItem} onClose={() => setPreviewItem(undefined)}
      />
    </>
  );
};


