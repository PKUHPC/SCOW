"use client";

import { ArrowLeftOutlined } from "@ant-design/icons";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import {
  Button, Card, Col, Divider, Form, Input, InputNumber, message,
  Row, Segmented, Select, Space, Spin, Steps, theme, Typography,
} from "antd";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { usePublicConfig } from "src/app/(auth)/context";
import { AccountSelector } from "src/components/AccountSelector";
import {
  ConfigurationSummary,
  MemoryAllocationDisplay,
  Partition,
  ResourceCard,
} from "src/components/devHost";
import { FileSelectModal } from "src/components/FileSelectModal";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { Status } from "src/models/Image";
import { ImageType as ImagePurpose } from "src/models/Image";
import { ImageSource } from "src/models/Job";
import { createK8sNameValidator } from "src/utils/form";
import { parseBooleanParam } from "src/utils/parse";
import { trpc } from "src/utils/trpc";
import { styled } from "styled-components";

type TimeUnit = "minutes" | "hours" | "days";

export enum ImageType {
  PUBLIC = "PUBLIC",
  PRIVATE = "PRIVATE",
  REMOTE = "REMOTE",
}

const { Title, Text } = Typography;
const { Step } = Steps;

interface FormFields {
  account: string;
  partition: string;
  hostName: string;
  image: { type?: ImageType; name?: number };
  remoteImageUrl?: string;
  mountPoints?: string[];
  qos: string;
  cpuCount?: number;
  gpuCount?: number;
  maxTimeMinutes: number;
}

const StyledCard = styled(Card)`
  margin-bottom: 16px;
  .ant-card-body {
    padding: 16px;
  }
`;


const generateHostName = (clusterId: string): string => {
  const timestamp = Date.now().toString().slice(-6);
  return `devhost-${clusterId}-${timestamp}`;
};

export const CreateDevHostForm = () => {
  const { token } = theme.useToken();
  const t = useI18nTranslateToString();
  const p = prefix("app.devHost.createPage.");
  const { currentLanguage } = useI18n();
  const router = useRouter();
  const [form] = Form.useForm<FormFields>();

  const selectedImage = Form.useWatch("image", form);
  const selectedRemoteImageUrl = Form.useWatch("remoteImageUrl", form);

  const [currentStep, setCurrentStep] = useState(0);
  const [selectedCluster, setSelectedCluster] = useState<string | undefined>();
  const [selectedPartition, setSelectedPartition] = useState<string | undefined>(undefined);
  const [selectedAccount, setSelectedAccount] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [imageSource, setImageSource] = useState<ImageSource>(ImageSource.LOCAL);
  const [cpuCount, setCpuCount] = useState<number>(1);
  const [gpuCount, setGpuCount] = useState<number>(1);
  const [maxTimeUnitValue, setMaxTimeUnitValue] = useState<TimeUnit>("hours");

  const imageType = Form.useWatch(["image", "type"], form);

  // 获取镜像数据
  const { data: images, isLoading: isImagesLoading } = trpc.image.list.useQuery({
    isPublic: parseBooleanParam(imageType === ImageType.PUBLIC),
    clusterId: selectedCluster || "",
    withExternal: "true",
  }, { enabled: !!selectedCluster });

  const imageOptions = useMemo(() => {
    return images?.items
      .filter((x) => x.status === Status.CREATED && x.types.includes(ImagePurpose.DEV_HOST))
      .map((x) => ({ label: `${x.name}:${x.tag}`, value: x.id }));
  }, [images, imageType]);

  const imageDescription = useMemo(() => {
    const imageDescObj: Record<number, string | undefined> = {};
    images?.items.forEach((x) => {
      imageDescObj[x.id] = x.description;
    });
    return imageDescObj;
  }, [images]);


  const { publicConfig, scowClusterConfigs } = usePublicConfig();


  // 获取用户关联的分区信息
  const {
    data: userPartitions, isLoading: partitionLoading,
  } = trpc.resource.getUserAssociatedClusterPartitions.useQuery();

  // 获取所有集群信息（用于未开启资源管理的情况）
  const clusterIds = publicConfig.CLUSTERS.map((cluster) => cluster.id);
  const {
    data: allClustersInfo, isLoading: allClustersLoading,
  } = trpc.dashboard.getAllClustersInfo.useQuery(
    { clusterIds },
    { enabled: clusterIds.length > 0 },
  );

  const {
    data: availablePartitions,
    isLoading: getAvailablePartitionLoading,
  } = trpc.config.getAvailablePartitions.useQuery(
    { accountName: selectedAccount || "", clusterId: selectedCluster || "" },
    { enabled: !!selectedAccount && !!selectedCluster },
  );

  // 根据选择的分区从availablePartitions中获取QOS选项
  const qosOptions = useMemo(() => {
    if (!selectedCluster || !selectedPartition || !availablePartitions) {
      return [];
    }

    const partition = availablePartitions.find((p) => p.name === selectedPartition);
    if (partition?.qos && partition.qos.length > 0) {
      return partition.qos.map((qos) => ({ label: qos, value: qos }));
    }

    return [];
  }, [selectedCluster, selectedPartition, availablePartitions]);

  // 从用户分区信息和所有集群信息中提取可用集群及其分区
  const availableClusters = useMemo(() => {
    if (partitionLoading || allClustersLoading) return [];

    // 先过滤掉未开启开发及功能的集群
    const devHostEnabledClusters = publicConfig.CLUSTERS.filter((cluster) =>
      scowClusterConfigs[cluster.id]?.ai.devHost.enabled);

    // 如果未配置资源管理系统，使用所有集群信息
    if (userPartitions?.clusterPartitions === undefined) {
      return devHostEnabledClusters.map((cluster) => {
        const clusterInfo = allClustersInfo?.clusters.find((c) => c.clusterId === cluster.id);
        return {
          id: cluster.id,
          name: getI18nConfigCurrentText(cluster.name, currentLanguage.id),
          partitions: clusterInfo?.partitions || [],
        };
      });
    }

    // 如果配置了资源管理系统，只返回已授权且有分区数据的集群
    const clusterPartitions = userPartitions.clusterPartitions;
    return devHostEnabledClusters
      .filter((cluster) => {
        const partitionNames = clusterPartitions?.[cluster.id];
        return partitionNames && partitionNames.length > 0;
      })
      .map((cluster) => {
        const userPartitionNames = clusterPartitions[cluster.id] || [];
        const clusterInfo = allClustersInfo?.clusters.find((c) => c.clusterId === cluster.id);
        const partitions = clusterInfo?.partitions.filter((p) =>
          userPartitionNames.includes(p.partitionName));

        return {
          id: cluster.id,
          name: getI18nConfigCurrentText(cluster.name, currentLanguage.id),
          partitions,
        };
      });
  }, [userPartitions, allClustersInfo, publicConfig.CLUSTERS, currentLanguage.id]);

  // 获取当前选中的分区信息
  const selectedPartitionInfo = useMemo(() => {
    if (!selectedCluster || !selectedPartition || !availableClusters) {
      return undefined;
    }
    const cluster = availableClusters.find((c) => c.id === selectedCluster);
    return cluster?.partitions?.find((p) => p.partitionName === selectedPartition) || undefined;
  }, [selectedCluster, selectedPartition, availableClusters]);

  // 计算内存分配
  const calculateMemory = useMemo(() => {
    if (!selectedPartitionInfo || !availablePartitions) {
      return { totalMemory: 0, allocatedMemory: 0 };
    }

    const partition = availablePartitions.find((p) => p.name === selectedPartitionInfo.partitionName);
    if (!partition) {
      return { totalMemory: 0, allocatedMemory: 0 };
    }

    let allocatedMemory = 0;
    if (selectedPartitionInfo.gpuCoreCount > 0) {
      // 有GPU的分区，按总内存数/总GPU数*选择的GPU数计算
      const memoryPerGpuUnit = partition.memMb / selectedPartitionInfo.gpuCoreCount;
      allocatedMemory = gpuCount * memoryPerGpuUnit;
    } else {
      // 只有CPU的分区，按CPU数量分配内存
      allocatedMemory = cpuCount * (partition.memMb / partition.cores);
    }

    return { totalMemory: partition.memMb, allocatedMemory };
  }, [selectedPartitionInfo, availablePartitions, cpuCount, gpuCount]);

  // 默认选中第一个可用集群
  useEffect(() => {
    if (availableClusters.length > 0 && !selectedCluster) {
      const sortedClusters = [...availableClusters].sort((a, b) => a.name.localeCompare(b.name));
      setSelectedCluster(sortedClusters[0].id);
    }
  }, [availableClusters, selectedCluster]);

  // 获取排序后的集群列表用于渲染
  const sortedAvailableClusters = useMemo(() => {
    return [...availableClusters].sort((a, b) => a.name.localeCompare(b.name));
  }, [availableClusters]);

  // 初始化表单默认值
  useEffect(() => {
    // 设置运行时限默认值为最大允许时间
    const defaultMaxTime = selectedCluster !== undefined ?
      scowClusterConfigs[selectedCluster]?.ai?.devHost.maxRunningTimeHours ?? 0 : 0;

    form.setFieldsValue({
      image: { type: ImageType.PRIVATE, name: undefined },
      cpuCount: 1,
      gpuCount: 1,
      maxTimeMinutes: defaultMaxTime,
    });
  }, [form, selectedCluster, scowClusterConfigs]);

  useEffect(() => {
    // 自动生成主机名
    if (selectedCluster) {
      form.setFieldsValue({
        hostName: generateHostName(selectedCluster),
        partition: undefined,
        account: undefined,
      });
      setSelectedPartition(undefined);
    }
  }, [selectedCluster, form]);

  // 重置资源配置的公共函数
  const resetResourceConfiguration = (partition: Partition) => {
    if (partition.gpuCoreCount > 0) {
      // 有GPU的分区，重置GPU数量为1，CPU数量会自动计算
      const calculatedCpuCount = Math.round(partition.cpuCoreCount / partition.gpuCoreCount);
      setGpuCount(1);
      setCpuCount(calculatedCpuCount);
      form.setFieldsValue({
        gpuCount: 1,
        cpuCount: calculatedCpuCount,
      });
    } else {
      // 只有CPU的分区，重置GPU数量为0，CPU数量为1
      setGpuCount(0);
      setCpuCount(1);
      form.setFieldsValue({
        gpuCount: 0,
        cpuCount: 1,
      });
    }
  };

  // 当分区信息变化时，重置资源配置
  useEffect(() => {
    if (selectedPartitionInfo) {
      resetResourceConfiguration(selectedPartitionInfo);
    }
  }, [selectedPartitionInfo, form]);

  // 设置优先级字段默认选中第一个选项
  useEffect(() => {
    if (qosOptions.length > 0 && !form.getFieldValue("qos")) {
      form.setFieldsValue({ qos: qosOptions[0].value });
    }
  }, [qosOptions, form]);

  // 修复页面导航时segment选择状态不一致的问题
  useEffect(() => {
    if (currentStep === 1) {
      const currentImageType = form.getFieldValue(["image", "type"]);
      if (currentImageType) {
        // 确保imageSource状态与表单中的imageType保持一致
        if (currentImageType === ImageType.REMOTE) {
          setImageSource(ImageSource.REMOTE);
        } else if (currentImageType === ImageType.PRIVATE || currentImageType === ImageType.PUBLIC) {
          setImageSource(ImageSource.LOCAL);
        }
      }
    }
  }, [currentStep, form]);

  const handleAccountChange = (account: string) => {
    setSelectedAccount(account);
    form.setFieldsValue({ account });
  };

  const handlePartitionSelect = (partition: Partition) => {
    setSelectedPartition(partition.partitionName);
    form.setFieldsValue({ partition: partition.partitionName });

    // 使用公共函数重置资源配置
    resetResourceConfiguration(partition);
  };

  const handleNextStep = () => {
    if (currentStep === 0) {
      if (!selectedAccount || !selectedPartition) {
        message.error(t(p("pleaseSelectAccountAndPartition")));
        return;
      }
    }
    setCurrentStep(currentStep + 1);
  };

  const handlePrevStep = () => {
    setCurrentStep(currentStep - 1);
  };

  const createDevHostMutation = trpc.devHost.createDevHost.useMutation();

  // 时间单位转换为分钟
  const convertTimeToMinutes = (time: number, unit: TimeUnit): number => {
    switch (unit) {
      case "minutes":
        return time;
      case "hours":
        return time * 60;
      case "days":
        return time * 24 * 60;
      default:
        return time;
    }
  };

  const handleSubmit = async (values: FormFields) => {
    setLoading(true);
    try {

      // 处理镜像配置
      let imageId: number | undefined;
      let isImagePrivate: boolean | undefined;
      let remoteImageUrl: string | undefined;

      if (imageSource === ImageSource.LOCAL && values.image?.name) {
        imageId = values.image.name;
        isImagePrivate = values.image.type === ImageType.PRIVATE;
      } else if (imageSource === ImageSource.REMOTE && values.remoteImageUrl) {
        remoteImageUrl = values.remoteImageUrl;
      }

      // 将时间转换为分钟，如果功能未开启则使用默认值
      let maxTimeMinutes: number;
      if (scowClusterConfigs[selectedCluster!]?.ai?.devHost.maxRunningTimeHours && values.maxTimeMinutes) {
        maxTimeMinutes = convertTimeToMinutes(values.maxTimeMinutes, maxTimeUnitValue);
      } else {
        // 不开启默认时限时，maxTimeMinutes 应该为 0，表示不限时
        maxTimeMinutes = 0;
      }

      // 计算正确的CPU数量
      let finalCpuCount: number;
      if (selectedPartitionInfo && selectedPartitionInfo.gpuCoreCount > 0 && gpuCount > 0) {
        // 有GPU的分区，根据GPU数量计算CPU数量
        finalCpuCount = Math.round((
          selectedPartitionInfo.cpuCoreCount / selectedPartitionInfo.gpuCoreCount) * gpuCount);
      } else {
        // 只有CPU的分区，使用用户选择的CPU数量
        finalCpuCount = cpuCount;
      }

      const submitData = {
        clusterId: selectedCluster!,
        devHostName: values.hostName,
        image: imageId,
        isImagePrivate,
        remoteImageUrl,
        mountPoints: values.mountPoints || [],
        account: values.account || selectedAccount || "",
        partition: values.partition,
        qos: values.qos,
        coreCount: finalCpuCount,
        gpuCount: (selectedPartitionInfo &&
          selectedPartitionInfo.gpuCoreCount > 0 && gpuCount > 0) ? gpuCount : undefined,
        memory: calculateMemory.allocatedMemory,
        maxTimeMinutes: maxTimeMinutes,
      };

      await createDevHostMutation.mutateAsync(submitData);
      message.success(t(p("createSuccess")));
      router.push("/devHost/list");
    } catch {
      message.error(t(p("createFailed")));
    } finally {
      setLoading(false);
    }
  };

  const renderResourceInfo = (partition: Partition) => {
    return (
      <ResourceCard
        partition={partition}
        isSelected={selectedPartition === partition.partitionName}
        onSelect={handlePartitionSelect}
        token={token}
      />
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div>
            <StyledCard>
              <Title
                level={4}
                style={{ fontSize: "18px", fontWeight: 500 }}
              >
                {t(p("selectClusterAndAccount"))}
              </Title>

              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Text strong>{t(p("cluster"))}</Text>
                  <div style={{ marginTop: 8 }}>
                    {allClustersLoading ? (
                      <Spin />
                    ) : (
                      <Space wrap>
                        {sortedAvailableClusters.map((cluster) => (
                          <Button
                            key={cluster.id}
                            type={selectedCluster === cluster.id ? "primary" : "default"}
                            onClick={() => setSelectedCluster(cluster.id)}
                          >
                            {cluster.name}
                          </Button>
                        ))}
                      </Space>
                    )}
                  </div>
                </Col>

                <Col span={12}>
                  <Text strong>{t(p("account"))}</Text>
                  <div style={{ marginTop: 8 }}>
                    {selectedCluster && (
                      <AccountSelector
                        cluster={selectedCluster}
                        value={selectedAccount}
                        onChange={handleAccountChange}
                      />
                    )}
                  </div>
                </Col>
              </Row>
            </StyledCard>

            <StyledCard style={{ marginTop: 24 }}>
              <Title
                level={4}
                style={{ fontSize: "18px", fontWeight: 500 }}
              >
                {t(p("selectPartition"))}
              </Title>
              <Text type="secondary">{t(p("resourceInfo"))}</Text>
              <Divider />
              {getAvailablePartitionLoading ? (
                <Spin />
              ) : (
                <div>
                  {selectedCluster && availableClusters.find(
                    (c) => c.id === selectedCluster)?.
                    partitions?.filter((p) => !!availablePartitions?.find((av) => av.name === p.partitionName)).
                    map((partition) => (
                      <div
                        key={partition.partitionName}
                        style={{ marginBottom: 16 }}
                      >
                        {renderResourceInfo(partition)}
                      </div>
                    )) || <Text>{t(p("noAvailablePartitions"))}</Text>}
                </div>
              )}
            </StyledCard>
          </div>
        );

      case 1:
        return (
          <div>
            {/* 显示Step1的选择结果 */}
            <ConfigurationSummary
              selectedCluster={selectedCluster}
              selectedAccount={selectedAccount}
              selectedPartition={selectedPartitionInfo}
              clusters={availableClusters}
              imageSource={imageSource}
              selectedImage={selectedImage}
              selectedRemoteImageUrl={selectedRemoteImageUrl}
              publicConfig={publicConfig}
            />

            <StyledCard>
              <Button
                type="link"
                icon={<ArrowLeftOutlined />}
                onClick={handlePrevStep}
                style={{ padding: 0 }}
              >
                {t(p("backToResourceSelection"))}
              </Button>
              <Title level={4} style={{ marginTop: 20 }}>{t(p("configureHost"))}</Title>

              <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
              >
                {/* 隐藏字段用于传递account和partition */}
                <Form.Item name="account" hidden>
                  <Input />
                </Form.Item>
                <Form.Item name="partition" hidden>
                  <Input />
                </Form.Item>

                <Form.Item
                  label={t(p("hostName"))}
                  name="hostName"
                  rules={[
                    { required: true, message: t(p("pleaseEnterHostName")) },
                    createK8sNameValidator(t(p("jobNameTips"))),
                  ]}
                >
                  <Input placeholder={t(p("autoGeneratedName"))} />
                </Form.Item>

                {/* 资源配置选择 */}
                <StyledCard style={{ marginBottom: 16, backgroundColor: token.colorFillAlter }}>
                  <Title
                    level={5}
                    style={{ marginBottom: 16, fontSize: "14px", fontWeight: "bold" }}
                  >
                    {t(p("resourceConfiguration"))}
                  </Title>

                  <Row gutter={[16, 16]}>
                    {selectedPartitionInfo && selectedPartitionInfo.gpuCoreCount > 0 ? (
                      // 有GPU的分区，显示GPU数量选择和对应的CPU分配
                      <>
                        <Col span={12}>
                          <Form.Item
                            label={t(p("acceleratorCount"))}
                            name="gpuCount"
                            rules={[{ required: true, message: t(p("pleaseSelectGpuCount")) }]}
                          >
                            <InputNumber
                              min={1}
                              max={selectedPartitionInfo.idleGpuCount}
                              value={gpuCount}
                              onChange={(value) => {
                                const count = value || 1;
                                setGpuCount(count);
                                form.setFieldsValue({ gpuCount: count });
                              }}
                              style={{ width: "100%" }}
                              placeholder={t(p("pleaseSelectGpuCount"))}
                            />
                          </Form.Item>
                          <Text type="secondary">
                            {t(p("availableGpus"))}: {selectedPartitionInfo.idleGpuCount} {t(p("unit"))}
                          </Text>
                        </Col>
                        <Col span={10} offset={1}>
                          <div
                            style={{
                              padding: "16px",
                              borderRadius: "6px",
                              background: token.colorBgContainer,
                              boxShadow: "0 2px 10px rgba(0, 0, 0, 0.1)",
                            }}
                          >
                            <Text strong>{t(p("resourceAllocation"))}</Text>

                            {/* CPU分配 */}
                            <div style={{ marginTop: 8 }}>
                              <Text>{t(p("cpuAllocation"))}:</Text>
                              <div style={{ marginTop: 2 }}>
                                <Text>
                                  <span>{t(p("allocatedCpu"))}: </span>
                                  <span style={{ color: token.colorPrimary, fontWeight: "bold" }}>
                                    {
                                      Math.round((
                                        selectedPartitionInfo.cpuCoreCount / selectedPartitionInfo.gpuCoreCount
                                      ) * gpuCount)
                                    } {t(p("unit"))}
                                  </span>
                                </Text>
                              </div>
                              <div style={{ marginTop: 2 }}>
                                <Text type="secondary">
                                  {t(p("ratio"))}: {
                                    Math.round(selectedPartitionInfo.cpuCoreCount / selectedPartitionInfo.gpuCoreCount)
                                  } {t(p("cpuGpuRatio"))}
                                </Text>
                              </div>
                            </div>

                            {/* 内存分配 */}
                            <MemoryAllocationDisplay
                              allocatedMemory={Math.round(calculateMemory.allocatedMemory)}
                              totalMemory={calculateMemory.totalMemory}
                              token={token}
                            />
                          </div>
                        </Col>
                      </>
                    ) : (
                      // 只有CPU的分区，显示CPU数量选择
                      <>
                        <Col span={12}>
                          <Form.Item
                            label={t(p("cpuCount"))}
                            name="cpuCount"
                            rules={[{ required: true, message: t(p("pleaseSelectCpuCount")) }]}
                          >
                            <InputNumber
                              min={1}
                              max={selectedPartitionInfo?.idleCpuCount || 1}
                              value={cpuCount}
                              onChange={(value) => {
                                const count = value || 1;
                                setCpuCount(count);
                                form.setFieldsValue({ cpuCount: count });
                              }}
                              style={{ width: "100%" }}
                              placeholder={t(p("pleaseSelectCpuCount"))}
                            />
                          </Form.Item>
                          <Text type="secondary">
                            {t(p("availableCpus"))}: {selectedPartitionInfo?.idleCpuCount || 0} {t(p("unit"))}
                          </Text>
                        </Col>

                        {/* 内存分配显示 */}
                        <Col span={10} offset={1}>
                          <MemoryAllocationDisplay
                            allocatedMemory={Math.round(calculateMemory.allocatedMemory)}
                            totalMemory={calculateMemory.totalMemory}
                            token={token}
                            showContainer={true}
                          />
                        </Col>
                      </>
                    )}
                  </Row>
                </StyledCard>

                <Form.Item
                  label={t(p("selectImage"))}
                  name={["image", "type"]}
                  rules={[{ required: true, message: t(p("pleaseSelectImageType")) }]}
                >
                  <Segmented
                    options={[
                      { label: t(p("myImages")), value: ImageType.PRIVATE },
                      { label: t(p("publicImages")), value: ImageType.PUBLIC },
                      { label: t(p("remoteImage")), value: ImageType.REMOTE },
                    ]}
                    onChange={(value) => {
                      if (value === ImageType.REMOTE) {
                        setImageSource(ImageSource.REMOTE);
                      } else if (value === ImageType.PRIVATE || value === ImageType.PUBLIC) {
                        setImageSource(ImageSource.LOCAL);
                      }
                      form.setFieldsValue({
                        image: { type: value, name: undefined },
                        remoteImageUrl: undefined,
                      });
                    }}
                    block
                  />
                </Form.Item>
                <div
                  style={{
                    border: `1px solid ${token.colorBorder}`,
                    borderRadius: 6, overflow: "hidden",
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      padding: "8px 12px",
                      backgroundColor: token.colorFillAlter,
                      borderBottom: `1px solid ${token.colorBorder}`,
                    }}
                  >
                    <div style={{ fontWeight: 500 }}>{t(p("imageSelection"))}</div>
                  </div>
                  <div style={{ padding: 16 }}>
                    {imageSource === ImageSource.LOCAL && (
                      <>
                        <Form.Item label={t(p("selectImage"))} required>
                          <Form.Item
                            name={["image", "name"]}
                            noStyle
                            rules={[
                              { required: true, message: "" },
                              {
                                validator: () => {
                                  const name = form.getFieldValue(["image", "name"]);
                                  const type = form.getFieldValue(["image", "type"]);
                                  if (!type || !name) {
                                    return Promise.reject(new Error(t(p("pleaseSelectImage"))));
                                  }
                                  return Promise.resolve();
                                },
                              },
                            ]}
                          >
                            <Select
                              style={{ width: "100%" }}
                              allowClear
                              loading={isImagesLoading && imageType !== undefined}
                              showSearch
                              optionFilterProp="label"
                              filterOption={(input, option) =>
                                (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                              }
                              options={imageOptions}
                              placeholder={t(p("pleaseSelectImage"))}
                            />
                          </Form.Item>
                        </Form.Item>

                        {/* 镜像描述显示 */}
                        {selectedImage?.name && (
                          <Form.Item label={t(p("imageDescription"))}>
                            <div style={{
                              padding: "8px 12px",
                              backgroundColor: token.colorFillAlter,
                              borderRadius: "6px",
                              border: `1px solid ${token.colorBorder}`,
                            }}
                            >
                              <Text type="secondary">
                                {imageDescription[selectedImage.name] || t(p("noDescription"))}
                              </Text>
                            </div>
                          </Form.Item>
                        )}
                      </>
                    )}

                    {imageSource === ImageSource.REMOTE && (
                      <>
                        <Form.Item
                          name="remoteImageUrl"
                          rules={[{ required: true, message: t(p("pleaseEnterRemoteImageUrl")) }]}
                          style={{ marginBottom: 16 }}
                        >
                          <Input placeholder={t(p("remoteImageUrlPlaceholder"))} />
                        </Form.Item>
                      </>
                    )}
                  </div>
                </div>
                <Form.Item label={t(p("mountPoints"))}>
                  <Form.List name="mountPoints">
                    {(fields, { add, remove }) => (
                      <>
                        {fields.map((field, index) => (
                          <Space key={field.key} style={{ display: "flex", marginBottom: 8 }} align="baseline">
                            <Form.Item
                              {...field}
                              rules={[{ required: true, message: t(p("pleaseEnterMountPath")) }]}
                              style={{ display: "flex", marginBottom: 0, flex: 2 }}
                            >
                              <Input
                                placeholder={t(p("mountPoint")) + ` ${index + 1}`}
                                style={{ minWidth: "400px" }}
                                prefix={(
                                  <FileSelectModal
                                    allowedFileType={["DIR"]}
                                    onSubmit={(path: string) => {
                                      form.setFieldValue(["mountPoints", field.name], path);
                                      form.validateFields([["mountPoints", field.name]]);
                                    }}
                                    clusterId={selectedCluster!}
                                  />
                                )}
                              />
                            </Form.Item>
                            <MinusCircleOutlined
                              onClick={() => remove(field.name)}
                              style={{ color: "#ff4d4f" }}
                            />
                          </Space>
                        ))}
                        <Form.Item style={{ marginBottom: 0 }}>
                          <Button
                            type="dashed"
                            onClick={() => add()}
                            icon={<PlusOutlined />}
                            style={{ width: "100%" }}
                          >
                            {t(p("addMountPoint"))}
                          </Button>
                        </Form.Item>
                      </>
                    )}
                  </Form.List>
                </Form.Item>

                <Row gutter={16}>
                  {/* 运行时限 */}
                  {scowClusterConfigs[selectedCluster!]?.ai?.devHost.maxRunningTimeHours && (
                    <Col span={12}>
                      <Form.Item
                        label={t(p("maxTime"))}
                        required
                        style={{ marginBottom: 16 }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                          <Form.Item
                            name="maxTimeMinutes"
                            style={{ marginBottom: 0, flex: 1 }}
                            rules={[
                              { required: true, message: t(p("pleaseInputMaxTime")) },
                              {
                                validator: (_, value) => {
                                  if (!value) return Promise.resolve();
                                  const timeInHours = convertTimeToMinutes(value, maxTimeUnitValue) / 60;
                                  if (timeInHours >
                                    scowClusterConfigs[selectedCluster!].ai.devHost.maxRunningTimeHours!) {
                                    return Promise.reject(
                                      new Error(t(p("runtimeLimitExceeded"),
                                        [
                                          scowClusterConfigs[selectedCluster!]?.ai?.
                                            devHost.maxRunningTimeHours?.toString() || "",
                                        ])),
                                    );
                                  }
                                  return Promise.resolve();
                                },
                              },
                            ]}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <InputNumber
                                min={1}
                                step={1}
                                precision={0}
                                style={{ flex: 1, minWidth: 120 }}
                                placeholder={t(p("inputMaxTime"))}
                                defaultValue={form.getFieldValue("maxTimeMinutes")}
                                onChange={(value) => {
                                  form.setFieldsValue({ maxTimeMinutes: value });
                                  // 实时验证最大时限
                                  if (value) {
                                    const timeInHours = convertTimeToMinutes(value, maxTimeUnitValue) / 60;
                                    if (timeInHours >
                                      scowClusterConfigs[selectedCluster!].ai.devHost.maxRunningTimeHours!) {
                                      form.setFields([{
                                        name: "maxTimeMinutes",
                                        errors: [
                                          t(p("runtimeLimitExceeded"),
                                            [
                                              scowClusterConfigs[selectedCluster!].ai.devHost.
                                                maxRunningTimeHours?.toString() || "",
                                            ]),
                                        ],
                                      }]);
                                    } else {
                                      form.setFields([{
                                        name: "maxTimeMinutes",
                                        errors: [],
                                      }]);
                                    }
                                  }
                                }}
                                addonAfter={(
                                  <Select
                                    value={maxTimeUnitValue}
                                    onChange={(value) => {
                                      setMaxTimeUnitValue(value);
                                      form.validateFields(["maxTimeMinutes"]);
                                    }}
                                    style={{ minWidth: 80 }}
                                  >
                                    <Select.Option value="minutes">{t(p("minutes"))}</Select.Option>
                                    <Select.Option value="hours">{t(p("hours"))}</Select.Option>
                                    <Select.Option value="days">{t(p("days"))}</Select.Option>
                                  </Select>
                                )}
                              />
                            </div>
                          </Form.Item>
                        </div>
                      </Form.Item>
                    </Col>
                  )}

                  <Col span={12}>
                    <Form.Item
                      label={t(p("priority"))}
                      name="qos"
                      rules={[{ required: true, message: t(p("pleaseSelectPriority")) }]}
                    >
                      <Select placeholder={t(p("pleaseSelectPriority"))}>
                        {qosOptions.map((qos) => (
                          <Select.Option key={qos.value} value={qos.value}>{qos.label}</Select.Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item>
                  <Space>
                    <Button onClick={handlePrevStep}>
                      {t(p("prevStep"))}
                    </Button>
                    <Button type="primary" htmlType="submit" loading={loading}>
                      {t(p("submit"))}
                    </Button>
                  </Space>
                </Form.Item>
              </Form>
            </StyledCard>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div>
      <Steps current={currentStep} style={{ marginBottom: 24 }}>
        <Step title={t(p("selectPartition"))} />
        <Step title={t(p("configureHost"))} />
      </Steps>

      {renderStepContent()}

      {currentStep === 0 && (
        <div style={{ textAlign: "left", marginTop: 16 }}>
          <Button
            type="primary"
            onClick={handleNextStep}
            disabled={!selectedAccount || !selectedPartition}
          >
            {t(p("nextStep"))}
          </Button>
        </div>
      )}
    </div>
  );
};
