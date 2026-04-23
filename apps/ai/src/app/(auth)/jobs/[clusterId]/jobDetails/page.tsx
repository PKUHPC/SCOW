"use client";

import type { DescriptionsProps, TableProps, TabsProps } from "antd";

import { CheckOutlined, LoadingOutlined, ReloadOutlined } from "@ant-design/icons";
import { TableWithSplitLines } from "@scow/lib-web/build/components/styledAntdCom/Table";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { Button, DatePicker, Descriptions, Divider, Flex, Select, Space, Table, Tabs, Typography } from "antd";
import { RangePickerProps } from "antd/es/date-picker";
import TextArea from "antd/lib/input/TextArea";
import dayjs from "dayjs";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { join } from "path";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { usePublicConfig } from "src/app/(auth)/context";
import { AppTableStatus } from "src/app/(auth)/jobs/jobList/AppSessionsTable";
import { CopyIcon, IconContainer } from "src/icons/operationIcon";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { useDarkMode } from "src/layouts/darkMode";
import { NotFoundPage } from "src/layouts/error/NotFoundPage";
import { JobType, statusColors } from "src/models/Job";
import { JobReasonI18nKeyMap } from "src/utils/common";
import { formatDateTime, toGrafanaRelative } from "src/utils/datetime";
import { formatSize } from "src/utils/format";
import { useDocumentTitle } from "src/utils/head";
import { trpc } from "src/utils/trpc";
import { styled, useTheme } from "styled-components";

import { MonitorGrid } from "./MonitorGrid";

const Container = styled.div`
  padding: 20px;
  margin: 8px 0;
  background: ${({ theme }) => theme.token.colorBgElevated};
  border: 1px solid ${({ theme }) => theme.token.colorBorderSecondary};
  border-radius: ${({ theme }) => theme.token.borderRadius}px;
  max-height: 1200px;
  overflow-y: auto;

  .ant-descriptions-item-label {
    width: 150px !important;
    display: inline-block;
  }
`;

const AutoWrapCell = styled.div`
  display: inline-block;
  width: max-content;
  max-width: 50ch;
  white-space: normal;
  overflow-wrap: anywhere;
  line-height: 1.5;
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
  podEndTime?: string;
  // pod状态的原因说明，当前适配器可返回 pending 和 部分 failed 的原因
  podReason?: string;
}

interface DetailTableDataType {
  key: number;
  name: string;
  value: string;
}

const CheckIconContainer = styled(IconContainer)`
  cursor: default;
  color: inherit;
  &:hover {
    background: transparent;
  }
`;

const INVALID_DATE = "1970-01-01T00:00:00.000Z";
const ALL = "all";
const CUSTOM = "custom";

export default function Page(props: { params: Promise<{ clusterId: string }> }) {
  const params = use(props.params);
  const t = useI18nTranslateToString();
  const p = prefix("app.jobs.jobDetails.");
  const languageId = useI18n().currentLanguage.id;
  const { clusterId } = params;
  const searchParams = useSearchParams();

  const { publicConfig, user, currentAvailableClusterIds } = usePublicConfig();
  const cluster = publicConfig.CLUSTERS.find((x) => x.id === clusterId);

  // ai配置文件的grafana配置
  const aiConfigGrafanaConfig = publicConfig.GRAFANA_CONFIG;
  // 集群配置文件的grafana配置
  const clusterGrafanaConfig = publicConfig.CLUSTERS_GRAFANA_CONFIG?.[clusterId];
  // 优先使用集群中的配置
  const grafanaConfig = clusterGrafanaConfig ?? aiConfigGrafanaConfig;
  const grafanaEnabled = !!grafanaConfig?.enabled;

  if (!cluster || !currentAvailableClusterIds.includes(clusterId)) {
    return <NotFoundPage />;
  }

  const router = useRouter();
  const theme = useTheme();
  const { dark } = useDarkMode();

  const detailTableStyle = {
    width: "100%",
    minWidth: "300px",
    maxHeight: "200px",
    overflowY: "auto" as const,
    overflowX: "auto" as const,
  };

  const renderAutoWrapCell = (text: string) => (
    <AutoWrapCell title={text}>{text}</AutoWrapCell>
  );

  const createDetailTableColumns = (
    firstTitle: string,
    secondTitle: string,
  ): TableProps<DetailTableDataType>["columns"] => [
      {
        title: firstTitle,
        dataIndex: "name",
        key: "name",
        render: renderAutoWrapCell,
      },
      {
        title: secondTitle,
        dataIndex: "value",
        key: "value",
        render: renderAutoWrapCell,
      },
    ];

  const jobId = searchParams?.get("jobId");
  const sessionId = searchParams?.get("sessionId");
  const jobType = searchParams?.get("jobType");
  const appId = searchParams?.get("appId");
  const from = searchParams?.get("from");

  const MONITOR_TIME_OPTIONS = useMemo(
    () => [
      { label: t(p("last1Hour")), value: "now-1h" },
      { label: t(p("last6Hours")), value: "now-6h" },
      { label: t(p("last12Hours")), value: "now-12h" },
      { label: t(p("last24Hours")), value: "now-24h" },
      { label: t(p("last2Days")), value: "now-2d" },
      { label: t(p("last7Days")), value: "now-7d" },
      { label: t(p("last30Days")), value: "now-30d" },
      { label: t(p("allData")), value: ALL },
      { label: t(p("customTime")), value: CUSTOM },
    ],
    [t, p],
  );

  useDocumentTitle(t(p("jobDetailsTab")));

  // pod列表中展示那个pod的事件
  const [selectedPodId, setSelectedPodId] = useState<string | null>(null);

  // 下拉选择时间框的值：比如最近1小时，最近30天等等
  const [monitorTime, setMonitorTime] = useState<string>(MONITOR_TIME_OPTIONS[0].value);
  // 用户自定义选择监控的精确时间
  const [monitorAccurateTime, setMonitorAccurateTime] = useState<RangePickerProps["value"]>(null);
  // 监控信息中选中的pod
  const [selectedMonitorPodIds, setSelectedMonitorPodIds] = useState<string[]>([]);
  // 监控的刷新
  const [reloadFlag, setReloadFlag] = useState(0);
  const monitorTimeUserTouchedRef = useRef(false);

  const parsedJobId = jobId ? parseInt(jobId, 10) : null;

  const { data: jobDetails, isLoading: isGettingJobDetailsLoading } = trpc.jobs.getJobDetails.useQuery(
    { clusterId, jobId: parsedJobId!, jobType: jobType!, appId: appId ?? undefined, sessionId: sessionId! },
    {
      enabled: !!parsedJobId && !!jobType,
      retry: false,
    },
  );

  const jobEventData = useMemo(() => (jobDetails ? jobDetails.jobEvent : []), [jobDetails]);
  const podListData = useMemo(() => (jobDetails ? jobDetails.podInfo : []), [jobDetails]);

  useEffect(() => {
    if (!jobDetails || monitorTimeUserTouchedRef.current) {
      return;
    }

    // 运行中的作业默认展示一小时，其他的展示全部数据
    const desiredMonitorTime =
      jobDetails.state === "RUNNING" ? MONITOR_TIME_OPTIONS[0].value : MONITOR_TIME_OPTIONS[7].value;

    setMonitorTime(desiredMonitorTime);
  }, [jobDetails, MONITOR_TIME_OPTIONS]);

  // 监控选择自定义时间，选完开始时间和结束时间都有值时才触发更新
  const lastStableUrlsRef = useRef<string[]>([]);
  // grafana的url是形如这样的：
  // "http://localhost:5007/mis/api/admin/monitor/getResourceStatus/d-solo/P17D2FB9C9DA87D76/p17d2fb9c9da87d76
  // ?from=1757395854652&to=1757397654652&var-job_name=dev-k8s-c-i-20250827-103214-1756262046
  // &var-pod_name=$__all&refresh=10s&panelId=24&theme=light";
  const monitorUrlArray = useMemo(() => {
    if (!jobDetails || !grafanaConfig) return [];

    // 选择需要展示的面板
    const {
      gpu: gpuPanelId,
      gpuMemory: gpuMemoryPanelId,
      cpu: cpuPanelId,
      memory: memoryPanelId,
      network: networkPanelId,
    } = grafanaConfig.panelIds;

    // 仅当 monitorTime === CUSTOM 且两个时间都有值时，才允许更新
    const isCustom = monitorTime === CUSTOM;
    const customReady = !!(monitorAccurateTime?.[0] && monitorAccurateTime?.[1]);

    if (isCustom && !customReady) {
      // 不更新，返回上一次稳定的 URL 列表
      return lastStableUrlsRef.current;
    }

    const displayPanelIds = [cpuPanelId, memoryPanelId, networkPanelId];
    if (jobDetails.gpusReq) {
      displayPanelIds.unshift(gpuPanelId, gpuMemoryPanelId);
    }

    const resolveGrafanaUrl = () => {
      if (grafanaConfig.isProxy) {
        const proxyUrl = grafanaConfig.proxyUrl;
        if (!proxyUrl) {
          return null;
        }
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        if (!origin) {
          return null;
        }
        try {
          return new URL(proxyUrl, origin).href;
        } catch {
          return null;
        }
      }
      return grafanaConfig.noProxyUrl || null;
    };

    const grafanaUrl = resolveGrafanaUrl();
    if (!grafanaUrl) {
      return [];
    }

    // 正确拼接基准 URL（不要用 path.join）
    // 支持 grafanaConfig.url 末尾是否带 '/'
    let base: URL;
    try {
      base = new URL(grafanaUrl.endsWith("/") ? grafanaUrl : grafanaUrl + "/");
    } catch {
      return [];
    }

    // 追加仪表盘路径（同样不要用 path.join）
    let dashboardUrl: URL;
    try {
      dashboardUrl = new URL(`d-solo/${grafanaConfig.dashboardId}/${grafanaConfig.dashboardName}`, base);
    } catch {
      return [];
    }

    // 4) 生成每个面板的完整 URL
    const urls = displayPanelIds.map((panelId) => {
      const qs = new URLSearchParams();

      let grafanaFrom = "",
        grafanaTo = "";
      if (monitorTime === CUSTOM) {
        if (monitorAccurateTime?.[0] && monitorAccurateTime?.[1]) {
          // 不直接用时间戳，要用类似[now-1h,now]的相对时间，grafana的refresh才能生效，数据会慢慢刷新增加

          // 精确时间给grafana绝对时间，不用刷新
          grafanaFrom = String(monitorAccurateTime[0].valueOf());
          grafanaTo = String(monitorAccurateTime[1].valueOf());
        }
      } else if (monitorTime === ALL) {
        const startTime = jobDetails.startTime ? dayjs(jobDetails.startTime).valueOf() : dayjs().valueOf();
        // 结束时间是有效的时间，表示作业已结束，可以给grafana绝对时间，不用刷新
        if (jobDetails.endTime && jobDetails.endTime !== INVALID_DATE) {
          grafanaFrom = String(startTime);
          grafanaTo = String(dayjs(jobDetails.endTime).valueOf());
        }
        // 结束时间是无效的时间，表示作业未结束，需要给grafana相对时间，刷新
        else {
          const { from, to } = toGrafanaRelative(startTime, dayjs().valueOf());

          grafanaFrom = from;
          grafanaTo = to;
        }
      } else {
        grafanaFrom = monitorTime;
        // running的作业传now，触发刷新；
        // 已结束的作业不需要，且不能加否则或触发grafana的bug：获取所有的正在跑的pod信息
        grafanaTo = jobDetails.state === "RUNNING" ? "now" : String(dayjs().valueOf());
      }

      // 时间
      qs.set("from", grafanaFrom);
      qs.set("to", grafanaTo);

      // 变量
      qs.set("var-job_name", jobDetails.uniqueJobName);
      selectedMonitorPodIds.forEach((podId) => qs.append("var-pod_name", podId));
      qs.set("panelId", String(panelId));
      qs.set("cluster", clusterId);

      // 只有running的作业才需要刷新数据
      if (jobDetails.state === "RUNNING") {
        qs.set("refresh", "5s");
      }
      // 其他参数
      qs.set("theme", dark ? "dark" : "light");

      // 加入 reloadFlag，手动刷新
      qs.set("_t", String(reloadFlag));

      return `${dashboardUrl.toString()}?${qs.toString()}`;
    });
    // 更新“上一次稳定结果”
    lastStableUrlsRef.current = urls;
    return urls;
  }, [grafanaConfig, monitorTime, monitorAccurateTime, jobDetails, selectedMonitorPodIds, dark, reloadFlag]);

  if (!parsedJobId || !jobType) {
    return <NotFoundPage />;
  }

  if (!jobDetails || isGettingJobDetailsLoading) {
    return <LoadingOutlined />;
  }

  const descriptionsItems: DescriptionsProps["items"] = [
    // 1.作业名
    {
      key: "1",
      label: t(p("jobName")),
      children: jobDetails.jobName,
    },
    // 2.集群
    {
      key: "2",
      label: t(p("cluster")),
      children: getI18nConfigCurrentText(cluster.name, languageId),
    },
    // 3.作业ID
    {
      key: "3",
      label: t(p("jobId")),
      children: jobId,
    },
    // 4.队列
    {
      key: "4",
      label: t(p("queue")),
      children: jobDetails.partition,
    },
    // 5.作业类型
    {
      key: "5",
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
    // 6.优先级
    {
      key: "6",
      label: t(p("priority")),
      children: jobDetails.qos,
    },
    // 7.状态
    // 该详情状态不需要显示颜色
    {
      key: "7",
      label: t(p("state")),
      children: jobDetails.state,
    },
    // 8.申请节点数
    {
      key: "8",
      label: t(p("nodesReq")),
      children: jobDetails.nodesReq,
    },
    // 9.用户
    {
      key: "9",
      label: t(p("user")),
      children: `${user.name}(ID: ${user.identityId})`,
    },
    // 10.分配节点数
    {
      key: "10",
      label: t(p("nodesAlloc")),
      children: jobDetails.nodesAlloc,
    },
    // 11.账户
    {
      key: "11",
      label: t(p("account")),
      children: jobDetails.account,
    },
    // 12.申请CPU核数
    {
      key: "12",
      label: t(p("cpusReq")),
      children: jobDetails.cpusReq,
    },
    // 13.提交时间
    {
      key: "13",
      label: t(p("submitTime")),
      children: jobDetails.submitTime ? formatDateTime(jobDetails.submitTime) : "-",
    },
    // 14.分配CPU核数
    {
      key: "14",
      label: t(p("cpusAlloc")),
      children: jobDetails.cpusAlloc,
    },
    // 15.开始时间
    {
      key: "15",
      label: t(p("startTime")),
      children:
        jobDetails.state === "PENDING" ? "-" : jobDetails.startTime ? formatDateTime(jobDetails.startTime) : "-",
    },
    // 16.申请GPU卡数
    {
      key: "16",
      label: t(p("gpusReq")),
      children: jobDetails.gpusReq,
    },
    // 17.结束时间
    {
      key: "17",
      label: t(p("endTime")),
      children:
        jobDetails.state === "RUNNING" || jobDetails.state === "PENDING"
          ? "-"
          : jobDetails.endTime
            ? formatDateTime(jobDetails.endTime)
            : "-",
    },
    // 18.分配GPU卡数
    {
      key: "18",
      label: t(p("gpusAlloc")),
      children: jobDetails.gpusAlloc,
    },
    // 19.最长运行时间
    {
      key: "19",
      label: t(p("timeLimit")),
      children: jobDetails.timeLimit || "-",
    },
    // 20.申请内存
    {
      key: "20",
      label: t(p("memReq")),
      children: formatSize(jobDetails.memReq, ["MB", "GB", "TB"]),
    },
    // 21.运行时长
    {
      key: "21",
      label: t(p("runningTime")),
      children: jobDetails.runningTime || "-",
    },
    // 22.分配内存
    {
      key: "22",
      label: t(p("memAlloc")),
      children: jobDetails.memAlloc ? formatSize(jobDetails.memAlloc, ["MB", "GB", "TB"]) : "-",
    },
    // 23.镜像：默认镜像/本地镜像/远程镜像
    {
      key: "23",
      label: t(p("image")),
      children: (() => {
        if (jobDetails.extraDisplayInputs?.isDefaultImage) {
          return t(p("defaultImage"));
        } else if (jobDetails.extraDisplayInputs?.imageNameOrUrl) {
          return jobDetails.extraDisplayInputs?.imageNameOrUrl;
        } else {
          return "-";
        }
      })(),
    },
    // 24.模型
    {
      key: "24",
      label: t(p("model")),
      children: (() => {
        if ((jobDetails.extraDisplayInputs?.modelNames?.length ?? 0) > 0) {
          return jobDetails.extraDisplayInputs?.modelNames?.join("；  ");
        } else {
          return "-";
        }
      })(),
    },
    // 25.算法，只在应用和训练时展示
    ...(jobType === JobType.APP || jobType === JobType.TRAIN
      ? [
        {
          key: "25",
          label: t(p("algorithm")),
          children: (() => {
            if ((jobDetails.extraDisplayInputs?.algorithmNames?.length ?? 0) > 0) {
              return jobDetails.extraDisplayInputs?.algorithmNames?.join("；  ");
            } else {
              return "-";
            }
          })(),
        },
      ]
      : []),
    // 26.数据集, 只在应用和训练时展示
    ...(jobType === JobType.APP || jobType === JobType.TRAIN
      ? [
        {
          key: "26",
          label: t(p("dataset")),
          children: (() => {
            if ((jobDetails.extraDisplayInputs?.datasetNames?.length ?? 0) > 0) {
              return jobDetails.extraDisplayInputs?.datasetNames?.join("；  ");
            } else {
              return "-";
            }
          })(),
        },
      ]
      : []),
    // 27.挂载点
    {
      key: "27",
      label: t(p("mountPoint")),
      contentStyle: { maxHeight: "none", overflowY: "visible", overflowX: "hidden" },
      children: (() => {
        const mountPointLength = jobDetails.extraDisplayInputs?.mountPoints?.length ?? 0;
        if (mountPointLength > 0) {
          return (
            <TableWithSplitLines
              dataSource={jobDetails.extraDisplayInputs?.mountPoints?.map((m, index) => ({
                key: index,
                name: m.path,
                value: m.target,
              }))}
              columns={createDetailTableColumns(t(p("mountPath")), t(p("mountTarget")))}
              pagination={false}
              scroll={{ x: "max-content" }}
              size="small"
              style={detailTableStyle}
            />
          );
        } else {
          return "-";
        }
      })(),
    },
    // 28.环境变量
    {
      key: "28",
      label: t(p("envVariable")),
      contentStyle: { maxHeight: "none", overflowY: "visible", overflowX: "hidden" },
      children: (() => {
        const variableLength = jobDetails.extraDisplayInputs?.envVariables?.length ?? 0;
        if (variableLength > 0) {
          return (
            <TableWithSplitLines
              dataSource={jobDetails.extraDisplayInputs?.envVariables?.map((env, index) => ({
                key: index,
                name: env.key,
                value: env.value,
              }))}
              columns={createDetailTableColumns(t(p("variableName")), t(p("variableValue")))}
              pagination={false}
              scroll={{ x: "max-content" }}
              size="small"
              style={detailTableStyle}
            />
          );
        } else {
          return "-";
        }
      })(),
    },
    // 29.运行命令
    {
      key: "29",
      label: t(p("command")),
      children: (() => {
        if (jobDetails.extraDisplayInputs?.startCommand) {
          return (
            <TextArea
              value={jobDetails.extraDisplayInputs?.startCommand}
              readOnly
              autoSize={{ minRows: 1, maxRows: 5 }}
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                border: "none",
                height: "130px",
                paddingTop: "0",
                paddingLeft: "0",
                backgroundColor: theme.token.colorBgTextHover,
                fontFamily: "inherit",
              }}
            />
          );
        } else {
          return "-";
        }
      })(),
    },
    // 30.训练作业时，TensorBoard地址；推理作业：推理服务地址; 其他空值占位
    ...(jobType === JobType.TRAIN
      ? [
        {
          key: "30",
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
        },
      ]
      : jobType === JobType.INFER
        ? [
          {
            key: "30",
            label: t(p("inferServiceAddress")),
            children: (() => {

              const webHost = window.location.hostname;
              const host = jobDetails.host;

              if (!jobDetails.port) {
                return "-";
              }
              // 如果没有host，默认在scow节点转发
              const targetHost = host ?? webHost;
              const inferServiceAddress = `${targetHost}:${jobDetails.port}`;
              const inferServiceUrl = `${window.location.protocol}//${inferServiceAddress}`;
              return (
                <Typography.Link
                  href={inferServiceUrl}
                  target="_blank"
                  // noopener: 防止新打开的页面通过 window.opener 访问原页面的控制权，避免恶意网站篡改原页面
                  // noreferrer: 隐藏来源页面的引用信息（Referer Header），同时包含 noopener 的效果
                  rel="noopener noreferrer"
                  copyable={{
                    text: inferServiceAddress,
                    tooltips: t("button.copyButton"),
                    icon: [
                      <CopyIcon key="copy" />,
                      <CheckIconContainer key="success">
                        <CheckOutlined style={{ fontSize: 13 }} />
                      </CheckIconContainer>
                    ],
                  }}
                >
                  <span style={{
                    textDecoration: "underline",
                    textUnderlineOffset: 2,
                    marginRight: 8
                  }}>
                    {inferServiceAddress}
                  </span>
                </Typography.Link>
              );
            }
            )(),
          },
        ]
        : [
          {
            key: "30",
            label: "",
            children: "",
          },
        ]),
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
      render: (_, record) => (record.time ? formatDateTime(record.time) : ""),
    },
  ];

  const tabsItems: TabsProps["items"] = [
    {
      key: "1",
      label: t(p("jobDetailsTab")),
      children: (
        <div
          style={{
            padding: "0px 32px 0px 0px",
          }}
        >
          <Descriptions
            column={2}
            items={descriptionsItems}
            labelStyle={{
              width: "150px",
              minWidth: "150px",
              paddingRight: "20px",
              fontWeight: "400",
            }}
            contentStyle={{
              paddingRight: "40px",
              wordBreak: "break-all",
              whiteSpace: "pre-wrap",
              lineHeight: "1.6",
              maxHeight: "130px",
              overflowY: "auto",
            }}
            style={{
              width: "100%",
            }}
          />
        </div>
      ),
    },
    ...(jobType !== JobType.INFER
      ? [
        {
          key: "2",
          label: t(p("jobEventsTab")),
          children: (
            <Table<EventDataType>
              columns={eventColumns}
              dataSource={jobEventData}
              pagination={{
                hideOnSinglePage: true,
                defaultPageSize: 4,
              }}
              scroll={{ y: 350 }}
            />
          ),
        },
      ]
      : []),
    ...(grafanaEnabled
      ? [
        {
          key: "3",
          label: t(p("monitor")),
          children: (
            <div style={{ maxHeight: "640px" }}>
              <Flex justify="space-between" style={{ marginBottom: "20px" }}>
                <Flex justify="space-between" align="center" style={{ width: "600px" }}>
                  <span>Pod: </span>
                  <Select
                    mode="multiple"
                    placeholder={t(p("selectPods"))}
                    defaultValue={[]}
                    style={{ width: "100%", marginLeft: "20px" }}
                    listHeight={200}
                    maxTagCount={1}
                    maxTagPlaceholder={(omittedValues) => `等${omittedValues.length + 1}个`}
                    options={podListData.map((pod) => ({
                      label: pod.podName,
                      value: pod.podName,
                    }))}
                    onChange={(value) => {
                      setSelectedMonitorPodIds(value);
                    }}
                  />
                </Flex>
                <Flex justify="space-between" align="center">
                  <Flex justify="space-between" align="center" style={{ width: "300px" }}>
                    <span style={{ minWidth: "70px" }}>{t(p("selectTime"))}:</span>
                    <Select
                      placeholder={t(p("selectTime"))}
                      value={monitorTime}
                      style={{ width: "100%", marginRight: "20px" }}
                      listHeight={200}
                      options={MONITOR_TIME_OPTIONS}
                      onChange={(v) => {
                        monitorTimeUserTouchedRef.current = true;
                        setMonitorTime(v);
                        setMonitorAccurateTime(null);
                      }}
                    />
                  </Flex>
                  <DatePicker.RangePicker
                    disabled={monitorTime !== CUSTOM}
                    value={monitorAccurateTime}
                    showTime
                    placeholder={[t(p("startTime")), t(p("endTime"))]}
                    allowClear={false}
                    onChange={setMonitorAccurateTime}
                  />
                  <Button
                    type="text"
                    icon={<ReloadOutlined />}
                    style={{ marginLeft: "20px" }}
                    onClick={() => setReloadFlag(Date.now())}
                  ></Button>
                </Flex>
              </Flex>
              <MonitorGrid sources={monitorUrlArray}></MonitorGrid>
            </div>
          ),
        },
      ]
      : []),
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
      render: (value) => <span style={{ color: statusColors[value.toUpperCase()] }}>{value}</span>,
    },
    {
      title: t(p("podCreatedTime")),
      dataIndex: "podCreatedTime",
      render: (_, record) => (record.podCreatedTime ? formatDateTime(record.podCreatedTime) : ""),
    },
    {
      title: t(p("podEndTime")),
      dataIndex: "podEndTime",
      render: (_, record) => (record.podEndTime ? formatDateTime(record.podEndTime) : ""),
    },
    {
      title: t(p("podReason")),
      dataIndex: "podReason",
      render: (_, record) => {
        if (!record.podReason) {
          return "";
        }
        const i18nKey = JobReasonI18nKeyMap[record.podReason.toUpperCase()];
        return i18nKey !== undefined ? t(i18nKey) : record.podReason;
      },
    },
    {
      title: t(p("action")),
      key: "action",
      render: (_, record) => (
        <Space>
          <a
            onClick={() => {
              if (selectedPodId === record.podId) {
                setSelectedPodId(null);
              } else {
                setSelectedPodId(record.podId);
              }
            }}
          >
            {t(p("viewEvents"))}
          </a>
          <Link href={`/jobs/${clusterId}/jobLogs/${record.podId}/${record.podName}`} target="_blank">
            {t(p("viewLogs"))}
          </Link>
          {from === AppTableStatus.UNFINISHED ? (
            <Link href={`/jobShell/${clusterId}/${jobId}/${record.namespace}/${record.podName}`} target="_blank">
              {t(p("enterContainer"))}
            </Link>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <>
      <Container>
        <a
          onClick={() => {
            router.push(
              join(`/jobs/jobList?jobType=${from === AppTableStatus.UNFINISHED ? "unfinishedJobs" : "historyJobs"}`),
            );
          }}
        >
          &lt; {t(p("return"))}
        </a>
        <Divider type="vertical" />
        <span>{jobDetails.jobName}</span>
        <Tabs
          defaultActiveKey="1"
          items={tabsItems}
          style={{
            overflow: "auto",
            height: "auto",
          }}
          tabBarStyle={{
            paddingRight: "20px",
          }}
        />
      </Container>
      <Container>
        <Table<PodListDataType>
          columns={podListColumns}
          dataSource={podListData}
          title={() => (
            <Typography.Title
              style={{
                fontSize: "16px",
                fontWeight: "400",
              }}
            >
              {t(p("podListTitle"))}
            </Typography.Title>
          )}
          pagination={{
            hideOnSinglePage: true,
            defaultPageSize: 4,
          }}
        />
      </Container>
      {selectedPodId &&
        (() => {
          const selectedPodData = podListData.find((pod) => pod.podId === selectedPodId);
          if (!selectedPodData) return null;

          return (
            <Container>
              <Table<EventDataType>
                title={() => (
                  <Typography.Title
                    style={{
                      fontSize: "16px",
                      fontWeight: "400",
                    }}
                  >
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
        })()}
    </>
  );
}
