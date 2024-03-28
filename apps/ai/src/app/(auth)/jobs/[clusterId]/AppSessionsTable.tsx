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

"use client";

import { ExclamationCircleOutlined } from "@ant-design/icons";
import { App, Button, Checkbox, Form, Input, Popconfirm, Space, Table, TableColumnsType, Tooltip } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { join } from "path";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { ModalButton } from "src/components/ModalLink";
import { JobType } from "src/models/Job";
import { Cluster } from "src/server/trpc/route/config";
import { AppSession } from "src/server/trpc/route/jobs/apps";
import { calculateAppRemainingTime, compareDateTime, formatDateTime } from "src/utils/datetime";
import { compareNumber } from "src/utils/math";
import { trpc } from "src/utils/trpc";

import { ConnectTopAppLink } from "./ConnectToAppLink";
import { SaveImageModal } from "./SaveImageModal";

interface FilterForm {
  appJobName: string | undefined
 }

export enum AppTableStatus {
  UNFINISHED = "UNFINISHED",
  FINISHED = "FINISHED"
}

interface Props {
  cluster: Cluster
  status: AppTableStatus
}

export function compareState(a: string, b: string): -1 | 0 | 1 {
  const endState = "ENDED";
  if (a === b || (a !== endState && b !== endState)) { return 0; }
  if (a === endState) { return -1; }
  return 1;
}

const SaveImageModalButton = ModalButton(SaveImageModal, { type: "link" });

export const AppSessionsTable: React.FC<Props> = ({ cluster, status }) => {

  const router = useRouter();
  const { message } = App.useApp();

  const unfinished = status === AppTableStatus.UNFINISHED;

  const [query, setQuery] = useState<FilterForm>(() => {
    return { appJobName: undefined };
  });
  const [form] = Form.useForm<FilterForm>();

  const [checked, setChecked] = useState(true);
  const [connectivityRefreshToken, setConnectivityRefreshToken] = useState(false);

  const { data, refetch, isLoading, isFetching } = trpc.jobs.listAppSessions.useQuery({
    clusterId: cluster.id, isRunning: unfinished,
  });

  const cancelJobMutation = trpc.jobs.cancelJob.useMutation({
    onError:(e) => {
      message.error(`操作失败: ${e.message}`);
    },
    onSuccess: () => {
      refetch();
    },
  });

  const columns: TableColumnsType<AppSession> = [
    {
      title: "作业ID",
      dataIndex: "jobId",
      width: "8%",
      sorter: (a, b) => compareNumber(a.jobId, b.jobId),
    },
    {
      title: "作业名",
      dataIndex: "sessionId",
      width: "25%",
      ellipsis: true,
    },
    {
      title: "类型",
      dataIndex: "jobType",
      width: "8%",
      render: (_, record) => {
        if (record.jobType === JobType.APP) {
          return "应用";
        }
        return "训练";
      },
    },
    {
      title: "应用",
      dataIndex: "appId",
      width: "8%",
      render: (appId: string, record) => record.appName ?? appId,
      sorter: (a, b) => (!a.submitTime || !b.submitTime) ? -1 : compareDateTime(a.submitTime, b.submitTime),
    },
    {
      title: "提交时间",
      dataIndex: "submitTime",
      width: "200px",
      render: (_, record) => record.submitTime ? formatDateTime(record.submitTime) : "",
    },
    {
      title: "状态",
      dataIndex: "state",
      width: "120px",
      render: (_, record) => (
        record.reason ? (
          <Tooltip title={record.reason}>
            <Space>
              {record.state}
              <ExclamationCircleOutlined />
            </Space>
          </Tooltip>
        ) : (
          <span>{record.state}</span>
        )
      ),
      sorter: (a, b) => compareState (a.state, b.state)
        ? compareState (a.state, b.state) :
        compareNumber(a.jobId, b.jobId),
      defaultSortOrder: "descend",

    },
    ...(unfinished ? [{
      title: "剩余时间",
      width: "100px",
      dataIndex: "remainingTime",
    },
    ] : []),
    {
      title: "操作",
      key: "action",
      fixed:"right",
      width: "350px",
      render: (_, record) => (
        <Space>
          {
            (record.state === "RUNNING") ? (
              <>
                {record.jobType === JobType.APP && (
                  <ConnectTopAppLink
                    session={record}
                    cluster={cluster.id}
                    refreshToken={connectivityRefreshToken}
                  />
                )}
                <Popconfirm
                  title="确定结束这个任务吗"
                  onConfirm={
                    async () => {
                      await cancelJobMutation.mutateAsync({
                        cluster: cluster.id,
                        jobId: record.jobId,
                      });
                      message.success("任务结束请求已经提交");
                    }
                  }
                >
                  <a>结束</a>
                </Popconfirm>
              </>
            ) : undefined
          }
          {
            (record.state === "PENDING" || record.state === "SUSPENDED") ? (
              <Popconfirm
                title="确定取消这个任务吗"
                onConfirm={
                  async () => {
                    await cancelJobMutation.mutateAsync({
                      cluster: cluster.id,
                      jobId: record.jobId,
                    });
                    message.success("任务取消请求已经提交");
                  }
                }
              >
                <a>取消</a>
              </Popconfirm>
            ) : undefined
          }
          {
            (record.state === "RUNNING" && record.jobType === JobType.APP) ? (
              <>
                <Link href={`/jobShell/${cluster.id}/${record.jobId}`} target="_blank">
                  {"进入容器"}
                </Link>
                <SaveImageModalButton
                  reload={refetch}
                  appSession={record}
                  clusterId={cluster.id}
                >保存镜像</SaveImageModalButton>
              </>
            ) : undefined
          }
          <a onClick={() => {
            router.push(join("/files", cluster.id, record.dataPath));
          }}
          >
            进入目录
          </a>
        </Space>
      ),
    },
  ];


  const reloadTable = useCallback(() => {
    refetch();
    setConnectivityRefreshToken((f) => !f);
  }, [setConnectivityRefreshToken]);

  useEffect(() => {
    if (checked && unfinished) {
      const interval = setInterval(() => {
        reloadTable();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [checked, unfinished]);

  const filteredData = useMemo(() => {
    if (!data) { return []; }
    return data.sessions.filter((x) => {
      if (query.appJobName) {
        return x.sessionId.toLowerCase().includes(query.appJobName!.toLowerCase());
      }
      return true;
    }).map((x) => ({
      ...x,
      remainingTime: x.state === "RUNNING" ? calculateAppRemainingTime(x.runningTime, x.timeLimit) :
        x.state === "PENDING" ? "" : x.timeLimit,
    }));
  }, [data, query]);

  return (
    <>
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
          <Form.Item label="作业名" name="appJobName">
            <Input style={{ minWidth: "160px" }} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">搜索</Button>
            </Space>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button loading={isLoading} onClick={() => refetch()}>刷新</Button>
            </Space>
          </Form.Item>
          {unfinished && (
            <Form.Item>
              <Checkbox
                checked={checked}
                onChange={(e) => { setChecked(e.target.checked); }}
              >
              10s自动刷新
              </Checkbox>
            </Form.Item>
          ) }
        </Form>
      </FilterFormContainer>
      <Table
        tableLayout="fixed"
        dataSource={filteredData}
        columns={columns}
        rowKey={(record) => record.sessionId}
        loading={isLoading || isFetching}
        scroll={{ x: filteredData?.length ? 1200 : true }}
        pagination={{
          showSizeChanger: true,
          defaultPageSize: 50,
        }}
      />
    </>
  );
};
