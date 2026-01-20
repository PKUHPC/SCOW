"use client";

import { ExclamationCircleOutlined } from "@ant-design/icons";
import { TableWrapper } from "@scow/lib-web/build/components/table/styleComponents";
import { compareTimeAsSeconds } from "@scow/lib-web/build/utils/math";
import { App, Button, Form, Input, Popconfirm, Popover, Space, Table, TableColumnsType, Tooltip } from "antd";
import { useRouter } from "next/navigation";
import { join } from "path";
import React, { useCallback, useMemo, useState } from "react";
import { usePublicConfig } from "src/app/(auth)/context";
import { defaultClusterContext } from "src/app/(auth)/defaultClusterContext";
import { SingleClusterSelector } from "src/components/ClusterSelector";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { ModalLink } from "src/components/ModalLink";
import { SaveImageModal } from "src/components/SaveImageModal";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { CancelIcon, DetailIcon, EndIcon, EnterDirectoryIcon, MoreIcon, NoHoverEndIcon,
  NoHoverSaveImageIcon, NoHoverSubmitAgainIcon, SubmitAgainIcon } from "src/icons/operationIcon";
import { JobType, statusColors } from "src/models/Job";
import { Cluster } from "src/server/trpc/route/config";
import { AppSession } from "src/server/trpc/route/jobs/apps";
import { JobReasonI18nKeyMap } from "src/utils/common";
import { calculateAppRemainingTime, compareDateTime, formatDateTime } from "src/utils/datetime";
import { formatSize } from "src/utils/format";
import { compareNumber } from "src/utils/math";
import { parseBooleanParam } from "src/utils/parse";
import { trpc } from "src/utils/trpc";
import { styled } from "styled-components";

import { ConnectTopAppLink } from "./ConnectToAppLink";

interface FilterForm {
  appJobName: string | undefined;
  cluster: Cluster;
}

export enum AppTableStatus {
  UNFINISHED = "UNFINISHED",
  FINISHED = "FINISHED",
}

interface Props {
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

export const AppSessionsTable: React.FC<Props> = ({ status }) => {
  const t = useI18nTranslateToString();
  const p = prefix("app.jobs.appSessionsTable.");

  const router = useRouter();
  const { message } = App.useApp();

  const { clusters, publicConfig: { CLUSTERS,BASE_PATH }, currentAssociateClusterIds } = usePublicConfig();

  const { defaultCluster, currentClusters }
      = defaultClusterContext(CLUSTERS, currentAssociateClusterIds ?? []);
  const initialCluster = defaultCluster ?? currentClusters[0];

  const unfinished = status === AppTableStatus.UNFINISHED;

  const [query, setQuery] = useState<FilterForm>(() => {
    return {
      appJobName: undefined,
      cluster: initialCluster,
    };
  });
  const clusterObj = useMemo(
    () => clusters.find((x) => x.id === query.cluster.id) ?? query.cluster,
    [clusters, query.cluster],
  );

  const [form] = Form.useForm<FilterForm>();

  const [connectivityRefreshToken, setConnectivityRefreshToken] = useState(false);

  const { data, refetch, isLoading, isFetching } = trpc.jobs.listAppSessions.useQuery({
    clusterId:query.cluster.id, isRunning: parseBooleanParam(unfinished),
    jobTypes: [JobType.APP, JobType.TRAIN, JobType.INFER],
  },
  { trpc: { context: { meta: { noBatch: true } } } },
  );

  const cancelJobMutation = trpc.jobs.cancelJob.useMutation({
    onError:(e) => {
      message.error(`${t(p("operateFailed"))}: ${e.message}`);
    },
    onSuccess: () => {
      refetch();
    },
  });

  const getCpu = (record: AppSession) => {
    return record.state === "PENDING" ? record.cpusReq : record.cpusAlloc;
  };
  const getGpu = (record: AppSession) => {
    return record.state === "PENDING" ? record.gpusReq : record.gpusAlloc;
  };

  const getMemory = (record: AppSession) => {
    return record.state === "PENDING" ? record.memReq : record.memAlloc;
  };

  const getNode = (record: AppSession) => {
    return record.state === "PENDING" ? record.nodesReq : record.nodesAlloc;
  };

  type AppSessionColumn = AppSession & { remainingTime: string };
  const columns: TableColumnsType<AppSessionColumn> = [
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
      sorter: (a, b) => a.jobName.localeCompare(b.jobName),
    },
    {
      title: t(p("partition")),
      dataIndex: "partition",
      width: "80px",
      ellipsis: true,
      sorter: (a, b) => a.partition.localeCompare(b.partition),
    },
    {
      title: "CPU",
      render: (_, record) => getCpu(record),
      width: "20px",
      ellipsis: true,
      sorter: (a, b) => compareNumber(getCpu(a), getCpu(b)),
    },
    {
      title: "GPU",
      render: (_, record) => getGpu(record),
      width: "20px",
      ellipsis: true,
      sorter: (a, b) => compareNumber(getGpu(a), getGpu(b)),
    },
    {
      title: t(p("memory")),
      width: "50px",
      ellipsis: true,
      render: (_, record) => formatSize(getMemory(record), ["MB", "GB", "TB"]),
      sorter: (a, b) => compareNumber(getMemory(a), getMemory(b)),
    },
    {
      title: t(p("node")),
      render: (_, record) => getNode(record),
      width: "20px",
      ellipsis: true,
      sorter: (a, b) => compareNumber(getNode(a), getNode(b)),
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
      sorter: (a, b) => a.jobType.localeCompare(b.jobType),
    },
    {
      title: t(p("app")),
      dataIndex: "appId",
      width: "40px",
      render: (appId: string, record) => record.appName ?? appId,
      sorter: (a, b) => {
        const aName = a.appName ?? a.appId ?? "";
        const bName = b.appName ?? b.appId ?? "";
        return aName.localeCompare(bName);
      },
    },
    {
      title: t(p("submitTime")),
      dataIndex: "submitTime",
      width: "200px",
      render: (_, record) => record.submitTime ? formatDateTime(record.submitTime) : "",
      sorter: (a, b) => compareDateTime(a.submitTime, b.submitTime),
    },
    {
      title: t(p("state")),
      dataIndex: "state",
      width: "120px",
      render: (_, record) => (
        // 有 reason 就显示
        record.reason ? (
          <Space>
            <span style={{ color: statusColors[record.state.toUpperCase()] }}>{record.state}</span>
            <Tooltip title={() => {
              const i18nKey = record.reason ? JobReasonI18nKeyMap[record.reason.toUpperCase()] : undefined;
              return i18nKey !== undefined ? t(i18nKey) : record.reason;
            }}
            >
              <ExclamationCircleOutlined />
            </Tooltip>
          </Space>
        ) : (
          <span style={{ color: statusColors[record.state.toUpperCase()] }}>{record.state}</span>
        )
      ),
      sorter: (a, b) => a.state.localeCompare(b.state),
    },
    ...(unfinished ? [{
      title: t(p("remainingTime")),
      width: "120px",
      dataIndex: "remainingTime",
      sorter: (a: AppSessionColumn, b: AppSessionColumn) => {
        return compareTimeAsSeconds(a.remainingTime, b.remainingTime);
      },
    }] : []),
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
            router.push(join(`/jobs/${query.cluster.id}/jobDetails?${searchParams.toString()}`));
          }}
        />
      </Tooltip>,
      <Tooltip title={t(p("enterDir"))}>
        <EnterDirectoryIcon
          onClick={() => {
            router.push(join("/files", record.dataPath));
          }}
        />
      </Tooltip>,
      <Tooltip title={t(p("submitAgain"))}>
        <SubmitAgainIcon onClick={async () => {
          let basePath = join(BASE_PATH,"jobs");
          const searchParams = new URLSearchParams({
            jobId:  record.jobId.toString(),
            sessionId: record.sessionId,
            clusterId: query.cluster.id,
          });

          if (record.jobType === JobType.APP) {
            if (record.appId) {
              basePath += `/createApp/${record.appId}`;
            }
          } else if (record.jobType === JobType.TRAIN) {
            basePath += "/createTrain";
          } else if (record.jobType === JobType.INFER) {
            basePath += "/createInfer";
          }
          // 不用router.push 因为第二次再次提交时，开发镜像和运行命令没法正确回显
          window.location.href = `${basePath}?${searchParams.toString()}`;
        }}
        />
      </Tooltip>,
      (record.state === "RUNNING") ? (
        <Popconfirm
          title={t(p("confirmFinish"))}
          onConfirm={
            async () => {
              await cancelJobMutation.mutateAsync({
                cluster: query.cluster.id,
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
                cluster: query.cluster.id,
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
              router.push(join(`/jobs/${query.cluster.id}/jobDetails?${searchParams.toString()}`));
            }}
          />
        </Tooltip>,
        <Tooltip title={t(p("enterDir"))}>
          <EnterDirectoryIcon
            onClick={() => {
              router.push(join("/files", record.dataPath));
            }}
          />
        </Tooltip>,
        <ConnectTopAppLink
          session={record}
          cluster={query.cluster.id}
          refreshToken={connectivityRefreshToken}
        />,
        <Popover
          content={[
            <Popconfirm
              title={t(p("confirmFinish"))}
              onConfirm={
                async () => {
                  await cancelJobMutation.mutateAsync({
                    cluster: query.cluster.id,
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
              const searchParams = new URLSearchParams({
                jobId:  record.jobId.toString(),
                sessionId: record.sessionId,
                clusterId: query.cluster.id,
              });

              const basePath = join(BASE_PATH,`/jobs/createApp/${record.appId}`);
              // 不用router.push 因为第二次再次提交时，开发镜像和运行命令没法正确回显
              window.location.href = `${basePath}?${searchParams.toString()}`;
            }}
            >
              <NoHoverSubmitAgainIcon />
              <span style={{ marginLeft: "8px" }}>{t(p("submitAgain"))}</span>
            </PopIconContainer>,
            <SaveImageModalButton
              appSession={record}
              clusterId={query.cluster.id}
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
            const { appJobName, cluster } = await form.validateFields();
            setQuery({
              appJobName,
              cluster,
            });
          }}
        >
          <Form.Item label={t(p("jobName"))} name="appJobName">
            <Input style={{ minWidth: "160px" }} />
          </Form.Item>
          <Form.Item label={t(p("cluster"))} name="cluster">
            <SingleClusterSelector
              defaultValue={clusterObj}
              onChange={(val) => {
                setQuery({ ...query,cluster:val });
              }}
            />
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
