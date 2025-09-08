"use client";

import { ExclamationCircleOutlined, QuestionCircleOutlined } from "@ant-design/icons";
import { TableWrapper } from "@scow/lib-web/build/components/table/styleComponents";
import { App, Button, Form, Input, Popconfirm, Popover, Space, Table, TableColumnsType, Tooltip } from "antd";
import { useRouter } from "next/navigation";
import { join } from "path";
import React, { useCallback, useMemo, useState } from "react";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { ModalLink } from "src/components/ModalLink";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { CancelIcon, DetailIcon, EndIcon, EnterDirectoryIcon, MoreIcon, NoHoverEndIcon,
  NoHoverSaveImageIcon, NoHoverSubmitAgainIcon, SubmitAgainIcon } from "src/icons/operationIcon";
import { JobType, statusColors } from "src/models/Job";
import { Cluster } from "src/server/trpc/route/config";
import { AppSession } from "src/server/trpc/route/jobs/apps";
import { calculateAppRemainingTime, compareDateTime, formatDateTime } from "src/utils/datetime";
import { formatSize } from "src/utils/format";
import { compareNumber } from "src/utils/math";
import { parseBooleanParam } from "src/utils/parse";
import { trpc } from "src/utils/trpc";
import { styled } from "styled-components";

import { ConnectTopAppLink } from "./ConnectToAppLink";
import { SaveImageModal } from "./SaveImageModal";

interface FilterForm {
  appJobName: string | undefined
}

export enum AppTableStatus {
  UNFINISHED = "UNFINISHED",
  FINISHED = "FINISHED",
}

interface Props {
  cluster: Cluster
  status: AppTableStatus
}

const PopIconContainer = styled.div`
  display: flex;
  align-items: center;
  border-radius: 6px;
  cursor: pointer;
  padding: 4px;
  &:hover {
    background: #B6000314;
  }
`;

const SaveImageModalButton = ModalLink(SaveImageModal);

export const AppSessionsTable: React.FC<Props> = ({ cluster, status }) => {
  const t = useI18nTranslateToString();
  const p = prefix("app.jobs.appSessionsTable.");

  const router = useRouter();
  const { message } = App.useApp();

  const unfinished = status === AppTableStatus.UNFINISHED;

  const [query, setQuery] = useState<FilterForm>(() => {
    return { appJobName: undefined };
  });
  const [form] = Form.useForm<FilterForm>();

  const [connectivityRefreshToken, setConnectivityRefreshToken] = useState(false);

  const { data, refetch, isLoading, isFetching } = trpc.jobs.listAppSessions.useQuery({
    clusterId: cluster.id, isRunning: parseBooleanParam(unfinished),
  });

  const cancelJobMutation = trpc.jobs.cancelJob.useMutation({
    onError:(e) => {
      message.error(`${t(p("operateFailed"))}: ${e.message}`);
    },
    onSuccess: () => {
      refetch();
    },
  });

  const columns: TableColumnsType<AppSession> = [
    {
      title: t(p("jobId")),
      dataIndex: "jobId",
      width: "20px",
      defaultSortOrder: "descend",
      sorter: (a, b) => compareNumber(a.jobId, b.jobId),
    },
    {
      title: t(p("jobName")),
      dataIndex: "jobName",
      width: "200px",
      ellipsis: true,
    },
    {
      title: t(p("partition")),
      dataIndex: "partition",
      width: "80px",
      ellipsis: true,
    },
    {
      title: "CPU",
      render: (_, record) => record.state === "PENDING" ? record.cpusReq : record.cpusAlloc,
      width: "20px",
      ellipsis: true,
    },
    {
      title: "GPU",
      render: (_, record) => record.state === "PENDING" ? record.gpusReq : record.gpusAlloc,
      width: "20px",
      ellipsis: true,
    },
    {
      title: t(p("memory")),
      width: "50px",
      ellipsis: true,
      render: (_, record) => formatSize(record.state === "PENDING" ? record.memReq : record.memAlloc ,
        ["MB", "GB", "TB"]),
    },
    {
      title: t(p("node")),
      render: (_, record) => record.state === "PENDING" ? record.nodesReq : record.nodesAlloc,
      width: "20px",
      ellipsis: true,
    },
    {
      title: t(p("jobType")),
      dataIndex: "jobType",
      width: "20px",
      render: (_, record) => {
        if (record.jobType === JobType.APP) {
          return t(p("app"));
        }
        else if (record.jobType === JobType.TRAIN) {
          return t(p("train"));
        }
        return t(p("infer"));
      },
    },
    {
      title: t(p("app")),
      dataIndex: "appId",
      width: "40px",
      render: (appId: string, record) => record.appName ?? appId,
    },
    {
      title: t(p("submitTime")),
      dataIndex: "submitTime",
      width: "200px",
      render: (_, record) => record.submitTime ? formatDateTime(record.submitTime) : "",
      sorter: (a, b) => compareDateTime(a.submitTime, b.submitTime),
    },
    {
      title: (
        <Space>
          {t(p("state"))}
          <Popover content={t(p("stateQuestionMarkLiteral"))}>
            <QuestionCircleOutlined />
          </Popover>
        </Space>
      ),
      dataIndex: "state",
      width: "120px",
      render: (_, record) => (
        record.reason ? (
          <Tooltip title={record.reason}>
            <Space>
              <span style={{ color: statusColors[record.state.toUpperCase()] }}>{record.state}</span>
              <ExclamationCircleOutlined />
            </Space>
          </Tooltip>
        ) : (
          <span style={{ color: statusColors[record.state.toUpperCase()] }}>{record.state}</span>
        )
      ),
      sorter: (a, b) => a.state.localeCompare(b.state),
      defaultSortOrder: "descend",
    },
    ...(unfinished ? [{
      title: t(p("remainingTime")),
      width: "120px",
      dataIndex: "remainingTime",
    },
    ] : []),
    {
      title: t(p("action")),
      key: "action",
      fixed:"right",
      width: unfinished ? "250px" : "120px",
      render: (_, record) => (
        <Space>
          {renderActionIcon(record)}
        </Space>
      ),
    },
  ];

  const reloadTable = useCallback(() => {
    refetch();
    setConnectivityRefreshToken((f) => !f);
  }, [refetch, setConnectivityRefreshToken]);

  const filteredData = useMemo(() => {
    if (!data) { return []; }

    return data.sessions.filter((x) => {
      if (query.appJobName) {
        // 之前的作业只有sessionId，没有存jobName
        const jobName = x.jobName ? x.jobName : x.sessionId;
        return jobName.toLowerCase().includes(query.appJobName.toLowerCase());
      }
      return true;
    }).map((x) =>
      ({
        ...x,
        jobName:x.jobName ? x.jobName : x.sessionId,
        remainingTime: x.state === "RUNNING" ? calculateAppRemainingTime(x.runningTime, x.timeLimit) :
          ["PENDING","QUEUED"].includes(x.state) ? "" : x.timeLimit,
      }),
    );

  }, [data, query]);

  const renderActionIcon = (record: AppSession) => {
    const actionIcons = [
      <Tooltip title={t(p("details"))}>
        <DetailIcon
          onClick={() => {
            const searchParams = new URLSearchParams({
              jobId:  record.jobId.toString(),
              jobType: record.jobType.toString(),
              appId: record.appId ?? "",
              from:status,
              sessionId:record.sessionId,
            });
            router.push(join(`/jobs/${cluster.id}/jobDetails?${searchParams.toString()}`));
          }}
        />
      </Tooltip>,
      <Tooltip title={t(p("enterDir"))}>
        <EnterDirectoryIcon
          onClick={() => {
            router.push(join("/files", cluster.id, record.dataPath));
          }}
        />
      </Tooltip>,
      <Tooltip title={t(p("submitAgain"))}>
        <SubmitAgainIcon onClick={async () => {
          let basePath = `/jobs/${cluster.id}`;
          const searchParams = new URLSearchParams({
            jobId:  record.jobId.toString(),
            sessionId: record.sessionId,
          });

          if (record.jobType === JobType.APP) {
            if (record.appId) {
              basePath += `/createApps/${record.appId}`;
            }
          } else if (record.jobType === JobType.TRAIN) {
            basePath += "/trainJobs";
          } else if (record.jobType === JobType.INFER) {
            basePath += "/inference";
          }
          router.push(`${basePath}?${searchParams.toString()}`);
        }}
        />
      </Tooltip>,
      (record.state === "RUNNING") ? (
        <Popconfirm
          title={t(p("confirmFinish"))}
          onConfirm={
            async () => {
              await cancelJobMutation.mutateAsync({
                cluster: cluster.id,
                jobId: record.jobId,
              });
              message.success(t(p("jobFinishReq")));
            }
          }
        >
          <Tooltip title={t("button.finishButton")}>
            <EndIcon />
          </Tooltip>
        </Popconfirm>
      ) : undefined,
      (record.state === "PENDING" || record.state === "SUSPENDED" || record.state === "QUEUED") ? (
        <Popconfirm
          title={t(p("confirmCancel"))}
          onConfirm={
            async () => {
              await cancelJobMutation.mutateAsync({
                cluster: cluster.id,
                jobId: record.jobId,
              });
              message.success(t(p("jobCancelReq")));
            }
          }
        >
          <Tooltip title={t("button.cancelButton")}>
            <CancelIcon />
          </Tooltip>
        </Popconfirm>
      ) : undefined,
    ];
    if (record.state === "RUNNING" && record.jobType === JobType.APP) {
      const showActionIcons = [
        <Tooltip title={t(p("details"))}>
          <DetailIcon
            onClick={() => {
              const searchParams = new URLSearchParams({
                jobId:  record.jobId.toString(),
                jobType: record.jobType.toString(),
                appId: record.appId ?? "",
                from:status,
                sessionId:record.sessionId,
              });
              router.push(join(`/jobs/${cluster.id}/jobDetails?${searchParams.toString()}`));
            }}
          />
        </Tooltip>,
        <Tooltip title={t(p("enterDir"))}>
          <EnterDirectoryIcon
            onClick={() => {
              router.push(join("/files", cluster.id, record.dataPath));
            }}
          />
        </Tooltip>,
        <ConnectTopAppLink
          session={record}
          cluster={cluster.id}
          refreshToken={connectivityRefreshToken}
        />,
        <Popover
          content={[
            <Popconfirm
              title={t(p("confirmFinish"))}
              onConfirm={
                async () => {
                  await cancelJobMutation.mutateAsync({
                    cluster: cluster.id,
                    jobId: record.jobId,
                  });
                  message.success(t(p("jobFinishReq")));
                }
              }
            >
              <PopIconContainer>
                <NoHoverEndIcon />
                <span style={{ marginLeft: "8px" }}>{t("button.finishButton")}</span>
              </PopIconContainer>
            </Popconfirm>,
            <PopIconContainer onClick={async () => {
              let basePath = `/jobs/${cluster.id}`;
              const searchParams = new URLSearchParams({
                jobId:  record.jobId.toString(),
                sessionId: record.sessionId,
              });

              if (record.jobType === JobType.APP) {
                if (record.appId) {
                  basePath += `/createApps/${record.appId}`;
                }
              } else if (record.jobType === JobType.TRAIN) {
                basePath += "/trainJobs";
              } else if (record.jobType === JobType.INFER) {
                basePath += "/inference";
              }
              router.push(`${basePath}?${searchParams.toString()}`);
            }}
            >
              <NoHoverSubmitAgainIcon />
              <span style={{ marginLeft: "8px" }}>{t(p("submitAgain"))}</span>
            </PopIconContainer>,
            <SaveImageModalButton
              reload={refetch}
              appSession={record}
              clusterId={cluster.id}
            >
              <PopIconContainer>
                <NoHoverSaveImageIcon />
                <span style={{ marginLeft: "8px", color: "#434343" }}>{t(p("saveImage"))}</span>
              </PopIconContainer>
            </SaveImageModalButton>,
          ]}
          trigger="click"
          placement="bottomRight"
        >
          <Tooltip title={t(p("more"))}>
            <MoreIcon />
          </Tooltip>
        </Popover>,
      ];
      return showActionIcons;
    } else {
      return actionIcons;
    }
  };

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
          <Form.Item label={t(p("jobName"))} name="appJobName">
            <Input style={{ minWidth: "160px" }} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">{t("button.searchButton")}</Button>
            </Space>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button loading={isLoading} onClick={() => reloadTable()}>{t("button.refreshButton")}</Button>
            </Space>
          </Form.Item>
        </Form>
      </FilterFormContainer>
      <TableWrapper>
        <Table
          tableLayout="fixed"
          dataSource={filteredData}
          columns={columns}
          rowKey={(record) => record.sessionId}
          loading={isLoading || isFetching}
          scroll={{ x: "max-content" }}
          pagination={{
            showSizeChanger: true,
            defaultPageSize: 50,
          }}
        />
      </TableWrapper>
    </>
  );
};
