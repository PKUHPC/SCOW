"use client";

import {
  DesktopOutlined, MoreOutlined, ReloadOutlined, SaveOutlined, StopOutlined,
} from "@ant-design/icons";
import {
  App, Button, Card, Dropdown, MenuProps, Modal, Select,
  Space, Table, Tag, Typography,
} from "antd";
import { ColumnsType } from "antd/es/table";
import { useRouter } from "next/navigation";
import { join } from "path";
import { useEffect, useState } from "react";
import { usePublicConfig } from "src/app/(auth)/context";
import { DevHostConnectLink } from "src/components/devHost/DevHostConnectLink";
import { SaveDevHostModal } from "src/components/devHost/SaveDevHostModal";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { AppName } from "src/models/App";
import { JobType } from "src/models/Job";
import { AppSession } from "src/server/trpc/route/jobs/apps";
import { formatDateTime } from "src/utils/datetime";
import { trpc } from "src/utils/trpc";

const { Text } = Typography;

interface PageInfo {
  page: number;
  pageSize: number;
}

export const DevHostList = () => {
  const t = useI18nTranslateToString();
  const p = prefix("app.devHost.listPage.");
  const { publicConfig, scowClusterConfigs } = usePublicConfig();
  const router = useRouter();

  const [selectedCluster, setSelectedCluster] = useState<string>("");
  const [pageInfo, setPageInfo] = useState<PageInfo>({ page: 1, pageSize: 10 });
  const [saveImageModalVisible, setSaveImageModalVisible] = useState(false);
  const [currentDevHost, setCurrentDevHost] = useState<AppSession | null>(null);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<AppSession | null>(null);
  const [shellConnectingJobId, setShellConnectingJobId] = useState<number | null>(null);
  const [connectivityRefreshToken, setConnectivityRefreshToken] = useState(false);

  // 获取Pod信息的mutation
  const getPodsMutation = trpc.jobs.getPodsByJobId.useMutation({
    onSuccess: (data, variables) => {
      const { jobId } = variables;
      if (data.pods && data.pods.length > 0) {
        const podName = data.pods[0].podName;
        // 从当前记录中获取partition信息
        const currentRecord = devHosts.find((host) => host.jobId === jobId);
        const partition = currentRecord?.partition || "";
        const url = join(publicConfig.BASE_PATH, "jobShell", selectedCluster, jobId.toString(), partition, podName);
        window.open(url, "_blank");
      } else {
        message.error(t(p("noPodFound")));
      }
      setShellConnectingJobId(null);
    },
    onError: (error) => {
      message.error(t(p("getPodInfoFailed"), [error.message]));
      setShellConnectingJobId(null);
    },
  });

  // 处理Shell连接
  const handleShellConnect = async (record: AppSession) => {
    if (record.state !== "RUNNING") {
      return;
    }

    setShellConnectingJobId(record.jobId);
    // 获取成功后会进行连接跳转操作
    await getPodsMutation.mutateAsync({
      cluster: selectedCluster,
      jobId: record.jobId,
    });
  };

  // 处理保存镜像
  const handleSaveImage = (record: AppSession) => {
    setCurrentDevHost(record);
    setSaveImageModalVisible(true);
  };

  // 关闭保存镜像模态框
  const handleCloseSaveImageModal = () => {
    setSaveImageModalVisible(false);
    setCurrentDevHost(null);
  };

  // 显示取消/停止模态框
  const showCancelModal = (record: AppSession) => {
    setCurrentRecord(record);
    setCancelModalVisible(true);
  };

  // 确认取消/停止操作
  const handleCancelConfirm = async () => {
    if (currentRecord) {
      await cancelJobMutation.mutateAsync({
        cluster: selectedCluster,
        jobId: currentRecord.jobId,
      });
      setCancelModalVisible(false);
      setCurrentRecord(null);
    }
  };

  // 取消模态框
  const handleCancelModalCancel = () => {
    setCancelModalVisible(false);
    setCurrentRecord(null);
  };

  // 获取开发机列表数据
  const { data, isLoading, isFetching, refetch } = trpc.jobs.listAppSessions.useQuery(
    {
      clusterId: selectedCluster,
      jobTypes: [JobType.DEV_HOST],
      ...pageInfo,
    },
    {
      enabled: !!selectedCluster,
    },
  );

  const { message } = App.useApp();

  const cancelJobMutation = trpc.jobs.cancelJob.useMutation({
    onError:(e) => {
      message.error(t(p("operationFailed"), [e.message]));
    },
    onSuccess: () => {
      refetch();
    },
  });

  const devHosts = data?.sessions || [];
  const totalCount = data?.count || 0;

  // 集群选择器选项
  const clusterOptions = publicConfig.CLUSTERS.filter((cluster) =>
    scowClusterConfigs[cluster.id]?.ai.devHost.enabled,
  ).map((cluster) => ({
    value: cluster.id,
    label: typeof cluster.name === "string" ?
      cluster.name : cluster.name.i18n?.zh_cn || cluster.name.i18n?.default || cluster.id,
  }));

  // 设置默认选择第一个集群
  useEffect(() => {
    if (clusterOptions.length > 0 && !selectedCluster) {
      setSelectedCluster(clusterOptions[0].value);
    }
  }, [clusterOptions, selectedCluster]);

  const getStatusTag = (state: string) => {
    const statusConfig: Record<string, { color: string; text: string; backgroundColor?: string }> = {
      RUNNING: { color: "green", text: t(p("statusRunning")) },
      COMPLETED: { color: "blue", text: t(p("statusCompleted")), backgroundColor: "#a9a9a9" },
      FAILED: { color: "red", text: t(p("statusFailed")) },
      PENDING: { color: "orange", text: t(p("statusPending")) },
      CANCELED: { color: "gray", text: t(p("statusCanceled")) },
    };

    const config = statusConfig[state] || { color: "default", text: state };
    return (
      <Tag
        color={config.color}
        style={{
          fontWeight: 500,
          ...(config.backgroundColor && { backgroundColor: config.backgroundColor, color: "white" }),
        }}
      >
        {config.text}
      </Tag>
    );
  };

  const columns: ColumnsType<AppSession> = [
    {
      title: t(p("name")),
      dataIndex: "jobName",
      key: "jobName",
    },
    {
      title: t(p("status")),
      dataIndex: "state",
      key: "state",
      render: (state: string) => getStatusTag(state),
    },
    {
      title: t(p("image")),
      dataIndex: "image",
      key: "image",
      width: 300,
      render: (image: AppSession["image"]) => (
        <Text code>{image.name}{image.tag ? `:${image.tag}` : ""}</Text>
      ),
    },
    {
      title: t(p("partition")),
      dataIndex: "partition",
      key: "partition",
    },
    {
      title: t(p("resourceConfig")),
      key: "resources",
      render: (_, record) => (
        <div>
          <div>CPU: {record.cpusAlloc} {t(p("cores"))}</div>
          <div>{t(p("memory"))}: {record.memAlloc} MB</div>
          {record.gpusAlloc > 0 && <div>GPU: {record.gpusAlloc} {t(p("cards"))}</div>}
        </div>
      ),
    },
    {
      title: t(p("runningTime")),
      dataIndex: "runningTime",
      key: "runningTime",
    },
    {
      title: t(p("submitTime")),
      dataIndex: "submitTime",
      key: "submitTime",
      render: (text: string) => formatDateTime(text),
    },
    {
      title: t(p("actions")),
      key: "actions",
      fixed: "right",
      width: 280,
      render: (_, record) => {
        const isRunning = record.state === "RUNNING";
        const items: MenuProps["items"] = [
          // 停止操作 - 仅对运行中的开发机显示
          ...(isRunning ? [{
            key: "stop",
            onClick: () => showCancelModal(record),
            label: (
              <span>
                <StopOutlined style={{ marginRight: 8 }} />
                {t(p("stop"))}
              </span>
            ),
          }] : []),
          // 取消操作 - 仅对等待中、暂停或排队中的开发机显示
          ...(["PENDING", "SUSPENDED", "QUEUED"].includes(record.state) ? [{
            key: "cancel",
            onClick: () => showCancelModal(record),
            label: (
              <span>
                <StopOutlined style={{ marginRight: 8 }} />
                {t(p("cancel"))}
              </span>
            ),
          }] : []),
          // 保存环境 - 仅对运行中的开发机显示
          ...(isRunning ? [{
            key: "saveImage",
            onClick: () => handleSaveImage(record),
            label: (
              <span>
                <SaveOutlined style={{ marginRight: 8 }} />
                {t(p("saveEnvironment"))}
              </span>
            ),
          }] : []),
          // 删除选项 - 已注释,未来可能需要放开
          // {
          //   key: "view",
          //   label: t(p("viewDetails")),
          //   icon: <EyeOutlined />,
          // },
        ];

        return (
          <Space size={8}>
            <DevHostConnectLink
              session={record}
              cluster={selectedCluster}
              appName={AppName.VSCODE}
              refreshToken={connectivityRefreshToken}
            />
            <DevHostConnectLink
              session={record}
              cluster={selectedCluster}
              appName={AppName.JUPYTER_LAB}
              refreshToken={connectivityRefreshToken}
            />
            <Button
              type="link"
              icon={<DesktopOutlined />}
              size="small"
              disabled={record.state !== "RUNNING"}
              loading={shellConnectingJobId === record.jobId}
              onClick={() => handleShellConnect(record)}
            >
              {t(p("enterShell"))}
            </Button>
            { items.length > 0 && (
              <Dropdown menu={{ items }} trigger={["hover"]}>
                <Button icon={<MoreOutlined />} size="small" />
              </Dropdown>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <Card>
        <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span>{t(p("cluster"))}:</span>
            <Select
              value={selectedCluster}
              onChange={setSelectedCluster}
              style={{ width: 200 }}
              placeholder={t(p("pleaseSelectCluster"))}
            >
              {clusterOptions.map((cluster) => (
                <Select.Option key={cluster.value} value={cluster.value}>
                  {cluster.label}
                </Select.Option>
              ))}
            </Select>
            <Button
              icon={<ReloadOutlined spin={isLoading} />}
              onClick={() => {
                refetch();
                setConnectivityRefreshToken((t) => !t);
              }}
              loading={isLoading || isFetching}
              title={t(p("refreshDevHostList"))}
            >
              {t(p("refresh"))}
            </Button>
          </div>
          <div>
            <Button
              type="primary"
              style={{ marginLeft: 16 }}
              onClick={() => router.push("/devHost/create")}
            >
              {t(p("createDevHost"))}
            </Button>
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={devHosts}
          rowKey="sessionId"
          loading={isLoading || isFetching}
          scroll={{ x: "max-content" }}
          style={{
            fontSize: "13px",
            fontWeight: 500,
          }}
          pagination={{
            current: pageInfo.page,
            pageSize: pageInfo.pageSize,
            total: totalCount,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              t(p("paginationTotal"), [range[0].toString(), range[1].toString(), total.toString()]),
            onChange: (page, pageSize) => setPageInfo({ page, pageSize }),
          }}
        />
      </Card>

      {/* 保存镜像模态框 */}
      {currentDevHost && (
        <SaveDevHostModal
          open={saveImageModalVisible}
          onClose={handleCloseSaveImageModal}
          reload={refetch}
          jobId={currentDevHost.jobId}
          clusterId={selectedCluster}
          imageName={currentDevHost.image.name}
          imageTag={currentDevHost.image.tag || "latest"}
        />
      )}

      {/* 取消/停止确认模态框 */}
      <Modal
        title={currentRecord?.state === "RUNNING" ? t(p("confirmStopDevHost")) : t(p("confirmCancelCreateDevHost"))}
        open={cancelModalVisible}
        onOk={handleCancelConfirm}
        onCancel={handleCancelModalCancel}
        confirmLoading={cancelJobMutation.isLoading}
        okText={t(p("confirm"))}
        cancelText={t(p("cancel"))}
      >
        <p>
          {currentRecord?.state === "RUNNING"
            ? t(p("confirmStopMessage"), [currentRecord?.jobName || ""])
            : t(p("confirmCancelMessage"), [currentRecord?.jobName || ""])
          }
        </p>
      </Modal>
    </div>
  );
};
