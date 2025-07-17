"use client";

import { LoadingOutlined } from "@ant-design/icons";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import type { DescriptionsProps, TableProps, TabsProps } from "antd";
import { Descriptions, Divider, Space, Table, Tabs, Typography } from "antd";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { join } from "path";
import { useMemo, useState } from "react";
import { usePublicConfig } from "src/app/(auth)/context";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { NotFoundPage } from "src/layouts/error/NotFoundPage";
import { JobType } from "src/models/Job";
import { formatDateTime } from "src/utils/datetime";
import { formatSize } from "src/utils/format";
import { trpc } from "src/utils/trpc";
import { styled } from "styled-components";

import { AppTableStatus } from "../AppSessionsTable";


const Container = styled.div`
  padding: 20px;
  margin: 8px 0;
  background: ${({ theme }) => theme.token.colorBgElevated};
  border: 1px solid ${({ theme }) => theme.token.colorBorderSecondary};
  border-radius: ${({ theme }) => theme.token.borderRadius}px;

.ant-descriptions-item-label {
  width: 150px !important;
  display: inline-block;
}
`;

interface EventDataType {
  type: string;
  reportingComponent: string;
  objKind: string;
  message: string;
  reason: string;
  time?: string;
}

interface PodListDataType {
  podName: string;
  podId: string;
  podIp: string;
  nodeName: string;
  podStatus: string;
  namespace: string;
  podCreatedTime?: string;
}

export default function Page({ params }: { params: { clusterId: string } }) {
  const t = useI18nTranslateToString();
  const p = prefix("app.jobs.jobDetails.");
  const languageId = useI18n().currentLanguage.id;
  const { clusterId } = params;
  const searchParams = useSearchParams();

  const { publicConfig,user } = usePublicConfig();
  const cluster = publicConfig.CLUSTERS.find((x) => x.id === clusterId);

  if (!cluster) {
    return <NotFoundPage />;
  }

  const router = useRouter();

  const jobId = searchParams?.get("jobId");
  const jobType = searchParams?.get("jobType");
  const appId = searchParams?.get("appId");
  const from = searchParams?.get("from");

  const [selectedPodId, setSelectedPodId] = useState<string | null>(null);

  const parsedJobId = jobId ? parseInt(jobId, 10) : null;

  const { data: jobDetails, isLoading: isGettingJobDetailsLoading } = trpc.jobs.getJobDetails.useQuery(
    { clusterId, jobId: parsedJobId!, jobType:jobType! ,appId:appId ?? undefined },
    {
      enabled: (!!parsedJobId && !!jobType),
      retry: false,
    },
  );

  const jobEventData = useMemo(() => jobDetails ? jobDetails.jobEvent : [], [jobDetails]);
  const podListData = useMemo(() => jobDetails ? jobDetails.podInfo : [], [jobDetails]);

  if (!parsedJobId || !jobType) {
    return <NotFoundPage />;
  }

  if (!jobDetails || isGettingJobDetailsLoading) {
    return <LoadingOutlined />;
  }

  const descriptionsItems: DescriptionsProps["items"] = [
    {
      key: "1",
      label: t(p("jobName")),
      children: jobDetails.jobName,
    },
    {
      key: "2",
      label: t(p("cluster")),
      children: getI18nConfigCurrentText(cluster.name, languageId),
    },
    {
      key: "3",
      label: t(p("jobId")),
      children: jobId,
    },
    {
      key: "4",
      label: t(p("queue")),
      children: jobDetails.partition,
    },
    {
      key: "5",
      label: t(p("state")),
      children: jobDetails.state,
    },
    {
      key: "6",
      label: t(p("priority")),
      children: jobDetails.qos,
    },
    {
      key: "7",
      label: t(p("user")),
      children: `${user.name}(ID: ${user.identityId})`,
    },
    {
      key: "8",
      label: t(p("cpusReq")),
      children: jobDetails.cpusReq,
    },
    {
      key: "9",
      label: t(p("account")),
      children: jobDetails.account,
    },
    {
      key: "10",
      label: t(p("cpusAlloc")),
      children: jobDetails.cpusAlloc,
    },
    {
      key: "11",
      label: t(p("submitTime")),
      children: jobDetails.submitTime ? formatDateTime(jobDetails.submitTime) : "",
    },
    {
      key: "12",
      label: t(p("gpusReq")),
      children: jobDetails.gpusReq,
    },
    {
      key: "13",
      label: t(p("startTime")),
      children: jobDetails.state === "PENDING" ? "-" :
        jobDetails.startTime ? formatDateTime(jobDetails.startTime) : "-",
    },
    {
      key: "14",
      label: t(p("gpusAlloc")),
      children: jobDetails.gpusAlloc,
    },
    {
      key: "15",
      label: t(p("endTime")),
      children: (jobDetails.state === "RUNNING" || jobDetails.state === "PENDING") ? "-" :
        jobDetails.endTime ? formatDateTime(jobDetails.endTime) : "-",
    },
    {
      key: "16",
      label: t(p("memReq")),
      children: formatSize(jobDetails.memReq, ["MB", "GB", "TB"]),
    },
    {
      key: "17",
      label: t(p("timeLimit")),
      children: jobDetails.timeLimit ?? "-",
    },
    {
      key: "18",
      label: t(p("memAlloc")),
      children: jobDetails.memAlloc ? formatSize(jobDetails.memAlloc, ["MB", "GB", "TB"]) : "-",
    },
    {
      key: "19",
      label: t(p("runningTime")),
      children: jobDetails.runningTime,
    },
    {
      key: "20",
      label: t(p("nodesReq")),
      children: jobDetails.nodesReq,
    },
    {
      key: "21",
      label: t(p("jobType")),
      children: (() => {
        if (jobType === JobType.APP) {
          return t(p("app"));
        } else if (jobType === JobType.TRAIN) {
          return t(p("train"));
        } else if (jobType === JobType.INFER) {
          return t(p("inference"));
        }
        return "-";
      })(),
    },
    {
      key: "20",
      label: t(p("nodesAlloc")),
      children: jobDetails.nodesAlloc,
    },
    ...(jobType === JobType.INFER
      ? [{
        key: "21",
        label: t(p("inferServiceAddress")),
        children: (() => {
          if (jobType === JobType.INFER) {
            const webHost = window.location.hostname;
            const host = jobDetails.host;

            if (!jobDetails.port) {
              return "-";
            }

            // 如果没有host，默认在scow节点转发
            if (!host) {
              return `${webHost}:${jobDetails.port}`;
            }

            return `${host}:${jobDetails.port}`;
          }
        })(),
      }]
      : []),
    ...(jobType === JobType.TRAIN
      ? [{
        key: "21",
        label: "TensorBoard",
        children: (() => {
          const node = jobDetails.tensorBoardInfo?.node;
          const port = jobDetails.tensorBoardInfo?.port;
          if (node && port) {
            // 复用应用连接中的absolute代理
            const pathname = join("/api/proxy", clusterId, "absolute", node, port.toString()) + "/";
            return (
              <Link href={pathname} target="_blank">
                {t(p("view"))}
              </Link>
            );
          }
          return "-";
        })(),
      }]
      : []),
  ];

  const eventColumns: TableProps<EventDataType>["columns"] = [
    {
      title: t(p("type")),
      dataIndex: "type",
    },
    {
      title: t(p("reportingComponent")),
      dataIndex: "reportingComponent",
    },
    {
      title: t(p("objKind")),
      dataIndex: "objKind",
    },
    {
      title: t(p("message")),
      dataIndex: "message",
      width: "50%",
    },
    {
      title: t(p("reason")),
      dataIndex: "reason",
    },
    {
      title: t(p("time")),
      dataIndex: "time",
      render: (_, record) => record.time ? formatDateTime(record.time) : "",
    },
  ];

  const tabsItems: TabsProps["items"] = [
    {
      key: "1",
      label: t(p("jobDetailsTab")),
      children: (
        <Descriptions
          column={2}
          items={descriptionsItems}
        />
      ),
    },
    ...jobType !== JobType.INFER ? [{
      key: "2",
      label: t(p("jobEventsTab")),
      children:
      (
        <Table<EventDataType>
          columns={eventColumns}
          dataSource={jobEventData}
          pagination={{
            hideOnSinglePage:true,
            defaultPageSize: 4,
          }}
          scroll={{ y: 350 }}
        />
      ),
    }] : [],
  ];

  const podListColumns: TableProps<PodListDataType>["columns"] = [
    {
      title: t(p("podName")),
      dataIndex: "podName",
    },
    {
      title: t(p("podIp")),
      dataIndex: "podIp",
    },
    {
      title: t(p("nodeName")),
      dataIndex: "nodeName",
    },
    {
      title: t(p("podStatus")),
      dataIndex: "podStatus",
    },
    {
      title: t(p("podCreatedTime")),
      dataIndex: "podCreatedTime",
      render: (_, record) => record.podCreatedTime ? formatDateTime(record.podCreatedTime) : "",
    },
    {
      title: t(p("action")),
      key:"action",
      render: (_, record) => (
        <Space>
          <a onClick={() => {
            if (selectedPodId === record.podId) {
              setSelectedPodId(null);
            } else {
              setSelectedPodId(record.podId);
            }
          }}
          >
            {t(p("viewEvents"))}
          </a>
          {
            from === AppTableStatus.UNFINISHED ? (
              <Link href={`/jobShell/${clusterId}/${jobId}/${record.namespace}/${record.podName}`} target="_blank">
                {t(p("enterContainer"))}
              </Link>
            ) : null
          }
          <Link href={`/jobs/${clusterId}/jobLogs/${record.podId}`} target="_blank">
            {t(p("viewLogs"))}
          </Link>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Container>
        <a
          style={{ fontWeight:600 }}
          onClick={() => {
            router.push(
              join(`/jobs/${clusterId}/${from === AppTableStatus.UNFINISHED ? "runningJobs" : "historyJobs"}`),
            );
          }}
        >
          &lt; {t(p("return"))}
        </a>
        <Divider type="vertical" />
        <span style={{ fontWeight:600 }}>{jobDetails.jobName}</span>
        <Tabs defaultActiveKey="1" items={tabsItems} style={{ height:"520px" }} />
      </Container>
      <Container>
        <Table<PodListDataType>
          columns={podListColumns}
          dataSource={podListData}
          title={() => (
            <Typography.Title level={5}>
              {t(p("podListTitle"))}
            </Typography.Title>
          )}
          pagination={{
            hideOnSinglePage:true,
            defaultPageSize: 4,
          }}
        />
      </Container>
      {
        selectedPodId && (() => {
          const selectedPodData = podListData.find((pod) => pod.podId === selectedPodId);
          if (!selectedPodData) return null;

          return (
            <Container>
              <Table<EventDataType>
                title={() => (
                  <Typography.Title level={5}>
                    {t(p("containerEventsTitle"), [selectedPodData.podName])}
                  </Typography.Title>
                )}
                columns={eventColumns}
                dataSource={selectedPodData.events}
                pagination={{
                  hideOnSinglePage: true,
                  defaultPageSize: 4,
                }}
              />
            </Container>
          );
        })()
      }
    </>
  );
}
