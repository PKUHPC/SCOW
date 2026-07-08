"use client";

import { ExclamationCircleOutlined } from "@ant-design/icons";
import { TrimInput as Input } from "@scow/lib-web/build/components/styledAntdCom/TrimInput";
import { TableWrapper } from "@scow/lib-web/build/components/table/styleComponents";
import { App, Button, Form, Popconfirm, Popover, Space, Table, TableColumnsType, Tooltip } from "antd";
import { useRouter } from "next/navigation";
import { join } from "path";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePublicConfig } from "src/app/(auth)/context";
import { defaultClusterContext } from "src/app/(auth)/defaultClusterContext";
import { SingleClusterSelector } from "src/components/ClusterSelector";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { ModalLink } from "src/components/ModalLink";
import { SaveImageModal } from "src/components/SaveImageModal";
import { prefix, useI18nTranslateToString } from "src/i18n";
import {
  CancelIcon,
  DetailIcon,
  EndIcon,
  EnterDirectoryIcon,
  MoreIcon,
  NoHoverEndIcon,
  NoHoverSaveImageIcon,
  NoHoverSubmitAgainIcon,
  SubmitAgainIcon,
} from "src/icons/operationIcon";
import { JobType, UNKNOWN_JOB_TYPE, statusColors } from "src/models/Job";
import { Cluster } from "src/server/trpc/route/config";
import { AppSession } from "src/server/trpc/route/jobs/apps";
import { JobReasonI18nKeyMap } from "src/utils/common";
import { formatDateTime } from "src/utils/datetime";
import { formatSize } from "src/utils/format";
import { parseBooleanParam } from "src/utils/parse";
import { trpc } from "src/utils/trpc";
import { styled } from "styled-components";
import type { SortOrder as AntdSortOrder } from "antd/es/table/interface";

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
  status: AppTableStatus;
}

interface PageInfo {
  page: number;
  pageSize: number;
}

type SortField = "job_id" | "submit_time" | "end_time";
type QuerySortOrder = "ASC" | "DESC";

interface SortInfo {
  field: SortField;
  order: QuerySortOrder;
}

const toAntdSortOrder = (order: QuerySortOrder | undefined): AntdSortOrder | undefined =>
  order === "ASC" ? "ascend" : order === "DESC" ? "descend" : undefined;

const PopIconContainer = styled.div`
  display: flex;
  align-items: center;
  border-radius: 6px;
  cursor: pointer;
  padding: 4px;
  &:hover {
    background: #b6000314;
  }
`;

const SaveImageModalButton = ModalLink(SaveImageModal);

export const AppSessionsTable: React.FC<Props> = ({ status }) => {
  const t = useI18nTranslateToString();
  const p = prefix("app.jobs.appSessionsTable.");

  const router = useRouter();
  const { message } = App.useApp();

  const {
    clusters,
    publicConfig: { CLUSTERS, BASE_PATH },
    currentAvailableClusterIds,
  } = usePublicConfig();

  const { defaultCluster, currentClusters } = defaultClusterContext(CLUSTERS, currentAvailableClusterIds ?? []);
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
  const [pageInfo, setPageInfo] = useState<PageInfo>({ page: 1, pageSize: 50 });
  const [sortInfo, setSortInfo] = useState<SortInfo>({ field: "job_id", order: "DESC" });
  const hasMountedRef = useRef(false);

  const [connectivityRefreshToken, setConnectivityRefreshToken] = useState(false);

  const listAppSessionsInput = useMemo(
    () => ({
      clusterId: query.cluster.id,
      isRunning: parseBooleanParam(unfinished),
      jobTypes: [JobType.APP, JobType.TRAIN, JobType.INFER],
      jobName: query.appJobName?.trim() || undefined,
      sortField: sortInfo.field,
      sortOrder: sortInfo.order,
      ...pageInfo,
    }),
    [pageInfo, query.appJobName, query.cluster.id, sortInfo.field, sortInfo.order, unfinished],
  );

  const { data, refetch, isLoading, isFetching } = trpc.jobs.listAppSessions.useQuery(listAppSessionsInput, {
    trpc: { context: { meta: { noBatch: true } } },
  });

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    refetch();
  }, [refetch, sortInfo.field, sortInfo.order]);

  const cancelJobMutation = trpc.jobs.cancelJob.useMutation({
    onError: (e) => {
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

  const columns: TableColumnsType<AppSession> = [
    {
      title: t(p("jobId")),
      dataIndex: "jobId",
      width: "20px",
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
      render: (_, record) => getCpu(record),
      width: "20px",
      ellipsis: true,
    },
    {
      title: "GPU",
      render: (_, record) => getGpu(record),
      width: "20px",
      ellipsis: true,
    },
    {
      title: t(p("memory")),
      width: "50px",
      ellipsis: true,
      render: (_, record) => formatSize(getMemory(record), ["MB", "GB", "TB"]),
    },
    {
      title: t(p("node")),
      render: (_, record) => getNode(record),
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
        } else if (record.jobType === JobType.TRAIN) {
          return t(p("train"));
        } else if (record.jobType === JobType.INFER) {
          return t(p("infer"));
        }
        return UNKNOWN_JOB_TYPE;
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
      render: (_, record) => (record.submitTime ? formatDateTime(record.submitTime) : ""),
      sorter: true,
      sortOrder: sortInfo.field === "submit_time" ? toAntdSortOrder(sortInfo.order) : undefined,
    },
    ...(!unfinished
      ? [
          {
            title: t(p("endTime")),
            dataIndex: "endTime",
            width: "200px",
            render: (_: unknown, record: AppSession) => (record.endTime ? formatDateTime(record.endTime) : ""),
            sorter: true,
            sortOrder: sortInfo.field === "end_time" ? toAntdSortOrder(sortInfo.order) : undefined,
          },
        ]
      : []),
    {
      title: t(p("state")),
      dataIndex: "state",
      width: "120px",
      render: (_, record) =>
        // 有 reason 就显示
        record.reason ? (
          <Space>
            <span style={{ color: statusColors[record.state.toUpperCase()] }}>{record.state}</span>
            <Tooltip
              title={() => {
                const i18nKey = record.reason ? JobReasonI18nKeyMap[record.reason.toUpperCase()] : undefined;
                return i18nKey !== undefined ? t(i18nKey) : record.reason;
              }}
            >
              <ExclamationCircleOutlined />
            </Tooltip>
          </Space>
        ) : (
          <span style={{ color: statusColors[record.state.toUpperCase()] }}>{record.state}</span>
        ),
    },
    {
      title: t(p("action")),
      key: "action",
      fixed: "right",
      width: unfinished ? "250px" : "120px",
      render: (_, record) => <Space>{renderActionIcon(record)}</Space>,
    },
  ];

  const reloadTable = useCallback(() => {
    refetch();
    setConnectivityRefreshToken((f) => !f);
  }, [refetch, setConnectivityRefreshToken]);

  const totalCount = data?.count ?? 0;

  const filteredData = useMemo(() => {
    if (!data) {
      return [];
    }

    return data.sessions
      .filter((x) => {
        if (query.appJobName) {
          const keyword = query.appJobName.trim().toLowerCase();
          if (!keyword) {
            return true;
          }

          return x.jobName?.toLowerCase().includes(keyword) ?? false;
        }

        return true;
      })
      .map((x) => ({
        ...x,
        jobName: x.jobName ? x.jobName : x.sessionId,
      }));
  }, [data, query.appJobName]);

  const renderActionIcon = (record: AppSession) => {
    const actionIcons = [
      <Tooltip title={t(p("details"))}>
        <DetailIcon
          onClick={() => {
            const searchParams = new URLSearchParams({
              jobId: record.jobId.toString(),
              jobType: record.jobType.toString(),
              appId: record.appId ?? "",
              from: status,
              sessionId: record.sessionId,
            });
            router.push(join(`/jobs/${query.cluster.id}/jobDetails?${searchParams.toString()}`));
          }}
        />
      </Tooltip>,
      <Tooltip title={t(p("enterDir"))}>
        <EnterDirectoryIcon
          onClick={() => {
            if (!record.workDir) return;
            router.push(join("/files", record.workDir));
          }}
        />
      </Tooltip>,
      <Tooltip title={t(p("submitAgain"))}>
        <SubmitAgainIcon
          onClick={async () => {
            let basePath = join(BASE_PATH, "jobs");
            const searchParams = new URLSearchParams({
              jobId: record.jobId.toString(),
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
      record.state === "RUNNING" ? (
        <Popconfirm
          title={t(p("confirmFinish"))}
          onConfirm={async () => {
            await cancelJobMutation.mutateAsync({
              cluster: query.cluster.id,
              jobId: record.jobId,
            });
            message.success(t(p("jobFinishReq")));
          }}
        >
          <Tooltip title={t("button.finishButton")}>
            <EndIcon />
          </Tooltip>
        </Popconfirm>
      ) : undefined,
      record.state === "PENDING" || record.state === "SUSPENDED" || record.state === "QUEUED" ? (
        <Popconfirm
          title={t(p("confirmCancel"))}
          onConfirm={async () => {
            await cancelJobMutation.mutateAsync({
              cluster: query.cluster.id,
              jobId: record.jobId,
            });
            message.success(t(p("jobCancelReq")));
          }}
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
                jobId: record.jobId.toString(),
                jobType: record.jobType.toString(),
                appId: record.appId ?? "",
                from: status,
                sessionId: record.sessionId,
              });
              router.push(join(`/jobs/${query.cluster.id}/jobDetails?${searchParams.toString()}`));
            }}
          />
        </Tooltip>,
        <Tooltip title={t(p("enterDir"))}>
          <EnterDirectoryIcon
            onClick={() => {
              if (!record.workDir) return;
              router.push(join("/files", record.workDir));
            }}
          />
        </Tooltip>,
        <ConnectTopAppLink session={record} cluster={query.cluster.id} refreshToken={connectivityRefreshToken} />,
        <Popover
          content={[
            <Popconfirm
              title={t(p("confirmFinish"))}
              onConfirm={async () => {
                await cancelJobMutation.mutateAsync({
                  cluster: query.cluster.id,
                  jobId: record.jobId,
                });
                message.success(t(p("jobFinishReq")));
              }}
            >
              <PopIconContainer>
                <NoHoverEndIcon />
                <span style={{ marginLeft: "8px" }}>{t("button.finishButton")}</span>
              </PopIconContainer>
            </Popconfirm>,
            <PopIconContainer
              onClick={async () => {
                const searchParams = new URLSearchParams({
                  jobId: record.jobId.toString(),
                  sessionId: record.sessionId,
                  clusterId: query.cluster.id,
                });

                const basePath = join(BASE_PATH, `/jobs/createApp/${record.appId}`);
                // 不用router.push 因为第二次再次提交时，开发镜像和运行命令没法正确回显
                window.location.href = `${basePath}?${searchParams.toString()}`;
              }}
            >
              <NoHoverSubmitAgainIcon />
              <span style={{ marginLeft: "8px" }}>{t(p("submitAgain"))}</span>
            </PopIconContainer>,
            <SaveImageModalButton appSession={record} clusterId={query.cluster.id}>
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
            setPageInfo({ page: 1, pageSize: pageInfo.pageSize });
          }}
        >
          <Form.Item label={t(p("jobName"))} name="appJobName">
            <Input style={{ minWidth: "160px" }} />
          </Form.Item>
          <Form.Item label={t(p("cluster"))} name="cluster">
            <SingleClusterSelector
              defaultValue={clusterObj}
              onChange={(val) => {
                setQuery({ ...query, cluster: val });
                setPageInfo({ page: 1, pageSize: pageInfo.pageSize });
              }}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {t("button.searchButton")}
              </Button>
            </Space>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button loading={isLoading} onClick={() => reloadTable()}>
                {t("button.refreshButton")}
              </Button>
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
          onChange={(pagination, _, sorter) => {
            const firstSorter = Array.isArray(sorter) ? sorter[0] : sorter;
            const hasSorterOrder = firstSorter.order === "ascend" || firstSorter.order === "descend";
            const sortField =
              !hasSorterOrder || firstSorter.field === "jobId"
                ? "job_id"
                : firstSorter.field === "endTime"
                  ? "end_time"
                  : "submit_time";
            const sortOrder = firstSorter.order === "ascend" ? "ASC" : "DESC";

            setSortInfo({ field: sortField, order: sortOrder });
            setPageInfo({
              page:
                sortField !== sortInfo.field || sortOrder !== sortInfo.order
                  ? 1
                  : pagination.current ?? pageInfo.page,
              pageSize: pagination.pageSize ?? pageInfo.pageSize,
            });
          }}
          pagination={{
            current: pageInfo.page,
            pageSize: pageInfo.pageSize,
            total: totalCount,
            showSizeChanger: true,
            onChange: (page, pageSize) => setPageInfo({ page, pageSize }),
          }}
        />
      </TableWrapper>
    </>
  );
};
