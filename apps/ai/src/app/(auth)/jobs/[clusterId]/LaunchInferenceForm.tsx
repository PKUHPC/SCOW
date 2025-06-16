"use client";

import { MinusCircleOutlined, PlusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { App, Button, Checkbox, Col,
  Divider, Form, Input, InputNumber, Radio,Row, Select, Space, Spin } from "antd";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AccountSelector } from "src/components/AccountSelector";
import { FileSelectModal } from "src/components/FileSelectModal";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { Status } from "src/models/Image";
import { ImageSource } from "src/models/Job";
import { ModelInterface, ModelVersionInterface } from "src/models/Model";
import { AccountStatusFilter } from "src/models/Resource";
import { InferenceJobInput } from "src/server/trpc/route/jobs/infer";
import { getIdPrivate } from "src/utils/app";
import { formatSize } from "src/utils/format";
import { parseBooleanParam } from "src/utils/parse";
import { trpc } from "src/utils/trpc";
import { styled, useTheme } from "styled-components";

import { validateMountPoints } from "./common";
import { setEntityInitData, useDataOptions, useDataVersionOptions } from "./hooks";
import { DataAttributes, getAssignedPartitions } from "./LaunchAppForm";

const AfterInputNumber = styled(InputNumber)`
  .ant-select-focused .ant-select-selector{
    color: ${({ theme }) => theme.token.colorText } !important;
  }
`;

interface Props {
  clusterId: string;
  clusterInfo: ClusterConfig;
  InferenceJobInput?: InferenceJobInput
}

interface FixedFormFields {
  appJobName: string;
  imageSource: ImageSource;
  image: { type: AccessibilityType, name: number };
  remoteImageUrl: string | undefined;
  isUnlimitedTime: boolean;
  showModel: boolean;
  modelArray: {
    index: DataAttributes;
  };
  mountPoints: string[] | undefined;
  partition: string | undefined;
  coreCount: number;
  nodeCount: number;
  gpuCount: number | undefined;
  account: string;
  maxTime: number;
  containerServicePort: number;
  command?: string;
}

type FormFields = FixedFormFields;
type TimeUnit = "min" | "hour" | "day";

interface ClusterConfig {
  partitions: Partition[];
  schedulerName: string,
}

interface Partition {
  name: string;
  memMb: number;
  cores: number;
  gpus: number;
  nodes: number;
  comment?: string;
  gpuType?: string;
}

export enum AccessibilityType {
  PUBLIC = "PUBLIC",
  PRIVATE = "PRIVATE",
}

// 生成默认应用名称，命名规则为"集群名-当前应用名-年月日-时分秒"
const genAppJobName = (clusterId: string, appName: string): string => {
  return `${clusterId}-${appName}-${dayjs().format("YYYYMMDD-HHmmss")}`;
};

const initialValues = {
  nodeCount:1,
  coreCount: 1,
  gpuCount: 1,
  maxTime: 60,
  isUnlimitedTime:true,
} as Partial<FormFields>;

const inputNumberFloorConfig = {
  formatter: (value: number | undefined) => `${Math.floor(value ?? 0)}`,
  parser: (value: string | undefined) => Math.floor(value ? +value : 0),
};


export const LaunchInferenceJobForm = (props: Props) => {

  const t = useI18nTranslateToString();
  const p = prefix("app.jobs.launchAppForm.");
  const pInfer = prefix("app.jobs.LaunchInferenceForm.");

  const { clusterId, clusterInfo,InferenceJobInput } = props;

  const { message } = App.useApp();
  const theme = useTheme();

  const router = useRouter();

  const [form] = Form.useForm<FormFields>();

  // 不关心状态值本身，只是用来触发渲染
  const [, forceUpdate] = useState(0);

  const [currentPartitionInfo, setCurrentPartitionInfo] = useState<Partition | undefined>();
  const [filteredClusterInfo, setFilteredClusterInfo] = useState<ClusterConfig | undefined>(clusterInfo);
  const [selectedAccountName, setSelectedAccountName] = useState<string | undefined>(undefined);

  const { data: associatedResourceDetails,
    isLoading: isAssociatedResourceDetailsLoading,
    refetch: refetchAssociatedResourceDetails }
    = trpc.resource.getUserAssignedResourceDetails.useQuery({
      accountStatusFilter: AccountStatusFilter.UNBLOCKED_ONLY });

  useEffect(() => {
    if (associatedResourceDetails?.results === undefined) {
      setFilteredClusterInfo(clusterInfo);
    };

    if (!selectedAccountName) {
      setFilteredClusterInfo(undefined);
    };

    if (selectedAccountName && associatedResourceDetails?.results) {
      const assignedPartitions
        = getAssignedPartitions(clusterId, selectedAccountName, associatedResourceDetails.results);
      const filteredPartitions = clusterInfo.partitions.filter((p) => (assignedPartitions?.includes(p.name)));
      setFilteredClusterInfo({
        ...clusterInfo,
        partitions: filteredPartitions,
      });
    }

  }, [associatedResourceDetails, clusterInfo, selectedAccountName]);


  const [maxTimeUnitValue, setMaxTimeUnitValue] = useState<TimeUnit>("min");

  const isUnlimitedTime = Form.useWatch("isUnlimitedTime", form);
  const imageSource = Form.useWatch("imageSource", form);

  // 记录添加了多少模型
  const [modelGroups, setModelGroups] = useState<{}[]>([]);

  // 用户是否修改了模型
  const [isModelTouched, setIsModelTouched] = useState(false);

  // 添加一组新的 Select 组件
  const handleAddModelGroup = () => {
    setModelGroups([...modelGroups, {}]);
    setIsModelTouched(true);

    const values = form.getFieldValue("modelArray");

    if (values) {
      form.setFieldValue(["modelArray"], values.concat([undefined]));
    } else {
      form.setFieldValue(["modelArray"], [undefined]);
    }
  };

  // 删除一组 Select 组件
  const handleRemoveModelGroup = (index: number) => {
    const newGroups = modelGroups.filter((_, idx) => idx !== index);
    setModelGroups(newGroups);
    setIsModelTouched(true);

    // 获取 form 中对应的值
    const values = form.getFieldValue("modelArray");
    if (values) {
    // 如果删除的是最后一组，则直接将该组的值置为空
      if (index === values.length - 1) {
        form.setFieldValue(["modelArray", index], undefined);
        return;
      }

      // 删除的是中间的组，移动后面的组的值到前一组
      for (let i = index; i < values.length - 1; i++) {
        const nextGroup = form.getFieldValue(["modelArray", i + 1]);

        // 将后面的值设置到当前组
        form.setFieldValue(["modelArray", i], nextGroup);

        if (i === values.length - 2) {
        // 最后一组置空
          form.setFieldValue(["modelArray", i + 1], undefined);
        }
      }
    }
  };

  useEffect(() => {
    const modelValues = form.getFieldValue("modelArray");
    if (modelValues && modelValues.length > modelGroups.length) {
      form.setFieldValue(["modelArray"], modelValues.slice(0, modelGroups.length));
    }
  }, [form, modelGroups]);

  const {
    privateData: privateModels, privateDataOptions: privateModelOptions,
    publicData: publicModels, publicDataOptions:publicModelOptions,
    isPrivateDataLoading:  isPrivateModelLoading,
    isPublicDataLoading:  isPublicModelLoading,
  } = useDataOptions<ModelInterface>(
    trpc.model.list.useQuery,
    clusterId,
    (x) => ({ label:`${x.name}(${x.owner})`, value: x.id }),
  );

  const {
    privateDataVersions: privateModelVersions,
    privateDataVersionOptions: privateModelVersionOptions,
    isPrivateDataVersionsLoading: isPrivateModelVersionsLoading,
    publicDataVersions: publicModelVersions,
    publicDataVersionOptions: publicModelVersionOptions,
    isPublicDataVersionsLoading:isPublicModelVersionsLoading,
  } =
    useDataVersionOptions<ModelVersionInterface>(
      privateModels.map((x) => x.id),
      publicModels.map((x) => x.id),
      "model",
      trpc.model.getMultipleModelVersions.useQuery,
      (x) => ({ label: x.versionName, value: x.id, desc:x.versionDescription }),
    );

  const imageType = Form.useWatch(["image", "type"], form);

  const isImagePublic = imageType !== undefined ? imageType === AccessibilityType.PUBLIC : imageType;

  const { data: images, isLoading: isImagesLoading } = trpc.image.list.useQuery({
    isPublic: isImagePublic !== undefined ? parseBooleanParam(isImagePublic) : undefined,
    clusterId,
    withExternal: "true",
  }, {
    enabled: isImagePublic !== undefined,
  });

  const imageOptions = useMemo(() => {
    return images?.items
      .filter((x) => x.status === Status.CREATED)
      .map((x) => ({ label: `${x.name}:${x.tag}`, value: x.id }));
  }, [images]);

  const imageDescription = useMemo(() => {
    const imageDescObj: Record<number,string | undefined> = {};

    images?.items.forEach((x) => {
      imageDescObj[x.id] = x.description;
    });

    return imageDescObj;
  }, [images]);

  const nodeCount = Form.useWatch("nodeCount", form);
  const coreCount = Form.useWatch("coreCount", form);
  const gpuCount = Form.useWatch("gpuCount", form)!;

  const imageId = Form.useWatch(["image", "name"], form);

  const memorySize = (currentPartitionInfo ?
    currentPartitionInfo.gpus ? nodeCount * gpuCount
    * Math.floor(currentPartitionInfo.cores / currentPartitionInfo.gpus)
    * Math.floor(currentPartitionInfo.memMb / currentPartitionInfo.cores) :
      nodeCount * coreCount * Math.floor(currentPartitionInfo.memMb / currentPartitionInfo.cores) : 0);
  const memoryDisplay = formatSize(memorySize, ["MB", "GB", "TB"]);

  const coreCountSum = currentPartitionInfo?.gpus
    ? nodeCount * gpuCount * Math.floor(currentPartitionInfo.cores / currentPartitionInfo.gpus)
    : nodeCount * coreCount;


  const handlePartitionChange = (partition: string) => {
    const partitionInfo = filteredClusterInfo
      ? filteredClusterInfo.partitions.find((x) => x.name === partition)
      : undefined;
    if (partitionInfo?.gpus) {
      form.setFieldValue("gpuCount", 1);
    } else {
      form.setFieldValue("coreCount", 1);
    }

    setCurrentPartitionInfo(partitionInfo);

  };

  useEffect(() => {
    // 处理再次提交作业模型数量
    const inputParams = InferenceJobInput;
    const { ids:modelIds, isPrivates:isModelPrivates } =
    inputParams?.models?.length ? getIdPrivate(inputParams.models) : {};

    if (modelIds?.length && isModelPrivates?.length) {
      if (!form.isFieldsTouched(["showModel"])) {
        setModelGroups(new Array(modelIds.length).fill({}));
      }
    }
  }, [InferenceJobInput]);

  useEffect(() => {
    // 处理模型相关数据
    const inputParams = InferenceJobInput;
    const { ids:modelIds, isPrivates:isModelPrivates } =
    inputParams?.models?.length ? getIdPrivate(inputParams.models) : {};

    if (modelIds?.length && isModelPrivates?.length) {
      modelIds.forEach((modelId,index) => {
        // 如果用户修改表单值，则不再初始化数据
        if (!isModelTouched && !form.isFieldsTouched(["showModel",
          ["model",index, "type"], ["model",index, "name"],
          ["model",index, "version"]])) {
          setEntityInitData<ModelVersionInterface, ModelInterface>(
            "modelArray",
            index,
            privateModels,
            privateModelVersions,
            publicModels,
            publicModelVersions,
            modelId,
            isModelPrivates[index],
            form,
            "showModel",
          );
        }
      });

    }
  }, [InferenceJobInput, privateModels,publicModels,
    privateModelVersions,publicModelVersions, form,isModelTouched]);

  // 处理镜像
  useEffect(() => {
    const inputParams = InferenceJobInput;
    if (inputParams && (inputParams.remoteImageUrl || inputParams.image)) {
      if (!form.isFieldsTouched([
        "imageSource",
        "remoteImageUrl",
        ["image", "type"],
        ["image", "name"],
      ])) {
        form.setFieldValue("imageSource", inputParams.remoteImageUrl ? ImageSource.REMOTE : ImageSource.LOCAL);
        if (images?.items?.length) {
          form.setFieldValue(["image", "name"], inputParams.image);
        } else {
          if (inputParams.remoteImageUrl) {
            form.setFieldValue("remoteImageUrl", inputParams.remoteImageUrl);
          } else {
            form.setFieldValue(["image", "type"], AccessibilityType.PRIVATE);
          }
        }
      }
    }
  }, [InferenceJobInput, images, form]);

  // 如果是再次提交，set已填入的值
  useEffect(() => {
    const inputParams = InferenceJobInput;
    if (inputParams) {
      const { account, partition, gpuCount, coreCount, maxTime, mountPoints, nodeCount,
        containerServicePort } = inputParams;
      const command = "command" in inputParams ? inputParams.command : undefined;

      form.setFieldsValue({
        mountPoints,
        nodeCount,
        account,
        partition,
        gpuCount,
        coreCount,
        maxTime,
        appJobName: genAppJobName(clusterId,"i"),
        command,
        containerServicePort,
      });

      setSelectedAccountName(account);
    }
  }, [InferenceJobInput]);

  // 根据授权队列信息 set队列
  useEffect(() => {
    const inputParams = InferenceJobInput;
    if (!inputParams) {
      form.setFieldsValue({
        partition: filteredClusterInfo?.partitions[0]?.name,
        appJobName: genAppJobName(clusterId, "i"),
      });
      setCurrentPartitionInfo(filteredClusterInfo?.partitions?.[0]);
    } else {
      const { partition } = inputParams;
      const foundPartition = filteredClusterInfo?.partitions?.find((p) => p.name === partition);
      const partitionWhenNotFound = filteredClusterInfo?.partitions?.[0];

      form.setFieldsValue({
        partition: foundPartition ? partition : partitionWhenNotFound?.name,
      });

      if (foundPartition && inputParams.partition) {
        setCurrentPartitionInfo(foundPartition);
      } else {
        setCurrentPartitionInfo(partitionWhenNotFound);
      }
    }
  }, [InferenceJobInput, filteredClusterInfo]);

  const inferenceJobMutation = trpc.jobs.submitInferJob.useMutation({
    onSuccess() {
      message.success(t(pInfer("submitSuccessfully")));
      router.push(`/jobs/${clusterId}/runningJobs`);
    },
    onError(e) {
      message.error(`${t(pInfer("submitFailed"))}: ${e.message}`);
    },
  });

  const transformTime = (amount: number) => {
    switch (maxTimeUnitValue) {
      case "hour":
        return amount * 60;
      case "day":
        return amount * 60 * 24;
      default:
        return amount;
    }
  };

  return (
    <Form
      form={form}
      initialValues={{
        ... initialValues,
        imageSource:ImageSource.LOCAL,
      }}
      labelAlign="left"
      onFinish={async () => {

        const { appJobName, image, remoteImageUrl,mountPoints, account, partition, coreCount,
          gpuCount, maxTime, command, containerServicePort } = await form.validateFields();

        const modelVersions =
                modelGroups.map((_,index) => form.getFieldValue(["modelArray", index, "version"]))
                  .filter((x) => x !== undefined);
        const isModelPrivates =
                modelGroups.map((_,index) =>
                  form.getFieldValue(["modelArray", index, "type"]) === AccessibilityType.PRIVATE)
                  .filter((x) => x !== undefined);

        await inferenceJobMutation.mutateAsync({
          clusterId,
          InferenceJobName: appJobName,
          image: image?.name,
          remoteImageUrl,
          models: modelVersions.map((id,idx) => ({ id,isPrivate:isModelPrivates[idx] })),
          mountPoints,
          account: account,
          partition: partition,
          nodeCount: nodeCount,
          coreCount: gpuCount ?
            gpuCount * Math.floor(currentPartitionInfo!.cores / currentPartitionInfo!.gpus) :
            coreCount,
          gpuCount: gpuCount,
          maxTime: isUnlimitedTime ? 0 : transformTime(maxTime),
          memory: memorySize,
          command: command || "",
          gpuType: currentPartitionInfo!.gpuType,
          containerServicePort,
        });
      }
      }
    >
      <Spin spinning={inferenceJobMutation.isLoading} tip="loading">
        <Form.Item name="appJobName" label={t(p("appJobName"))} rules={[{ required: true }, { max: 42 }]}>
          <Input />
        </Form.Item>
        <Divider orientation="left" orientationMargin="0">
          {t(pInfer("inferConfig"))}
        </Divider>
        <Form.Item
          label={"选择镜像类型"}
          name="imageSource"
        >
          <Radio.Group
            onChange={() => {
              form.setFieldsValue({
                image: { type: undefined, name: undefined },
                remoteImageUrl: undefined,
              });
            }}
            style={{ userSelect:"none" }}
          >
            <Radio value={ImageSource.LOCAL}> {t("app.jobs.launchAppForm.localImage")}</Radio>
            <Radio value={ImageSource.REMOTE}> {t("app.jobs.launchAppForm.remoteImage")}</Radio>
          </Radio.Group>
        </Form.Item>
        {
          (imageSource === ImageSource.LOCAL) && (
            <>
              <Form.Item label={t(p("image"))} required>
                <Space>
                  <Form.Item name={["image", "type"]} noStyle rules={[{ required: true, message: "" }]}>
                    <Select
                      allowClear
                      style={{ minWidth: 100 }}
                      onChange={() => {
                        form.setFieldsValue({ image: { name: undefined } });
                      }}
                      options={
                        [
                          {
                            value: AccessibilityType.PRIVATE,
                            label: t(p("privateImage")),
                          },
                          {
                            value:  AccessibilityType.PUBLIC,
                            label: t(p("publicImage")),
                          },
                        ]
                      }
                    />
                  </Form.Item>
                  <Form.Item
                    name={["image", "name"]}
                    noStyle
                    rules={[
                      { required: true, message: "" },
                      {
                        validator: () => {
                          const name = form.getFieldValue(["image", "name"]);
                          const type = form.getFieldValue(["image", "type"]);

                          // 如果 type 、 version 或 name 其中有一个没有值，返回错误信息
                          if (!type || !name) {
                            return Promise.reject(new Error(t(p("selectImage"))));
                          }

                          return Promise.resolve();
                        },
                      },
                    ]}
                  >
                    <Select
                      style={{ minWidth: 200 }}
                      allowClear
                      loading={isImagesLoading && isImagePublic !== undefined}
                      showSearch
                      optionFilterProp="label"
                      options={imageOptions}
                    />
                  </Form.Item>
                </Space>
              </Form.Item>
            </>
          )
        }
        {
          imageSource !== ImageSource.REMOTE && (
            <Form.Item label={t(p("imageDesc"))}>
              {imageId ? imageDescription[imageId] : null }
            </Form.Item>
          )
        }
        {
          imageSource === ImageSource.REMOTE && (
            <Form.Item
              label={t(p("remoteImageUrl"))}
              name="remoteImageUrl"
              required
              rules={[{ required:true }]}
            >
              <Input placeholder={t(p("RemoteImageUrlPlaceholder"))} />
            </Form.Item>
          )
        }

        <Form.Item
          label={t(pInfer("containerServicePort"))}
          name="containerServicePort"
          rules={[
            {
              required: true,
              type: "integer",
            },
          ]}
        >
          <InputNumber
            min={1}
            max={undefined}
            {...inputNumberFloorConfig}
          />
        </Form.Item>
        <Form.List name="mountPoints">
          {(fields, { add, remove }) => (
            <>
              {fields.map((field, index) => {
                const { key, ...restField } = field;

                return (
                  <Space key={field.key} style={{ display: "flex", marginBottom: 8 }} align="baseline">
                    <Form.Item
                      {...restField}
                      label={`${t(p("mounts"))}-${index + 1}`}
                      rules={[
                        { required: true, message: t(p("mountsPlaceholder")) },
                        // 添加的自定义校验器以确保挂载点不重复
                        validateMountPoints(t(p("mountsDuplicate"))),
                      ]}
                    >
                      <Input
                        placeholder={t(p("selectMounts"))}
                        prefix={(
                          <FileSelectModal
                            allowedFileType={["DIR"]}
                            onSubmit={(path: string) => {
                            // 当用户选择路径后触发表单的值更新并进行校验
                              form.setFieldValue(["mountPoints", field.name], path);
                              // 校验特定的挂载点字段
                              form.validateFields([["mountPoints", field.name]]);
                            }}
                            clusterId={clusterId ?? ""}
                          />
                        )}
                      />
                    </Form.Item>
                    <MinusCircleOutlined
                      onClick={() => remove(field.name)}
                    />
                  </Space>
                );
              })}
              <Form.Item>
                <Button
                  type="dashed"
                  onClick={() => add()}
                  icon={<PlusOutlined />}
                >
                  {t(p("addMounts"))}
                </Button>
              </Form.Item>
            </>
          )}
        </Form.List>
        <Divider orientation="left" orientationMargin="0">{t(pInfer("addModel"))}</Divider>
        <Form.Item label={t(p("addType"))} style={{ marginBottom: 0 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <Form.Item
              name="showModel"
              valuePropName="checked"
              style={{ display: "inline-block", marginRight: 8 }}
            >
              <Checkbox onChange={(e) => {
                if (e.target.checked) {
                  handleAddModelGroup();
                } else {
                  setModelGroups([]);
                  form.setFieldValue(["modelArray"], undefined);
                }
              }
              }
              >
                {t(p("model"))}
              </Checkbox>
            </Form.Item>
          </div>
        </Form.Item>

        {modelGroups.map((_, index) => {
          const isPrivate = form.getFieldValue(["modelArray", index, "type"]) === AccessibilityType.PRIVATE;

          const modelOptions = isPrivate ? privateModelOptions : publicModelOptions;
          const modelVersionOptionsArray =
          isPrivate ? privateModelVersionOptions : publicModelVersionOptions;

          const selectedName = form.getFieldValue(["modelArray", index, "name"]);
          const modelIndex = modelOptions.findIndex((option) => option.value === selectedName);

          const modelVersionOptions = modelIndex !== -1 && modelVersionOptionsArray
            ? modelVersionOptionsArray[modelIndex] : [];

          const selectedVersion = form.getFieldValue(["modelArray", index, "version"]);
          const versionIndex = modelVersionOptions.findIndex((option) => option.value === selectedVersion);

          return (
            <>
              <Form.Item
                label={`${t(p("model"))}-${index + 1}`}
                labelCol={{ span: 1, style: { minWidth: "70px" } }}
                wrapperCol={{ span: 23 }}
                key={index}
              >
                <Space>
                  <Form.Item
                    name={["modelArray", index, "type"]}
                    noStyle
                    rules={[{ required: true, message: "" }]}
                  >
                    <Select
                      allowClear
                      style={{ minWidth: 120 }}
                      onChange={() => {
                        setIsModelTouched(true);
                        form.setFieldsValue({
                          modelArray: {
                            [index]: { name: undefined, version: undefined },
                          },
                        });
                        // 强制再次渲染，不然后面的name，version的selectOptions不会变
                        forceUpdate((prev) => prev + 1);
                      }}
                      options={
                        [
                          {
                            value: AccessibilityType.PRIVATE,
                            label: t(p("privateModel")),
                          },
                          {
                            value:  AccessibilityType.PUBLIC,
                            label: t(p("publicModel")),
                          },
                        ]
                      }
                    />
                  </Form.Item>
                  <Form.Item
                    name={["modelArray",index, "name"]}
                    noStyle
                    rules={[{ required: true, message: "" }]}
                  >
                    <Select
                      allowClear
                      style={{ minWidth: 200 }}
                      onChange={() => {
                        setIsModelTouched(true);
                        form.setFieldValue(["modelArray",index, "version"], undefined);
                        forceUpdate((prev) => prev + 1);
                      }}
                      loading={isPrivate ? isPrivateModelLoading : isPublicModelLoading}
                      showSearch
                      optionFilterProp="label"
                      options={modelOptions}
                    />
                  </Form.Item>
                  <Form.Item
                    name={["modelArray",index, "version"]}
                    noStyle
                    rules={[
                      { required: true, message: "" },
                      {
                        validator: () => {
                          const name = form.getFieldValue(["modelArray",index, "name"]);
                          const type = form.getFieldValue(["modelArray",index, "type"]);
                          const version = form.getFieldValue(["modelArray",index, "version"]);

                          // 如果 type 、 version 或 name 其中有一个没有值，返回错误信息
                          if (!type || !version || !name) {
                            return Promise.reject(new Error(t(p("selectModel"))));
                          }

                          return Promise.resolve();
                        },
                      },
                    ]}
                  >
                    <Select
                      allowClear
                      style={{ minWidth: 100 }}
                      loading={isPrivate ? isPrivateModelVersionsLoading : isPublicModelVersionsLoading}
                      showSearch
                      optionFilterProp="label"
                      onChange={() => {
                        setIsModelTouched(true);
                        forceUpdate((prev) => prev + 1);
                      }}
                      options={modelVersionOptions}
                    />
                  </Form.Item>
                  {
                    index === modelGroups.length - 1 && (
                      <PlusCircleOutlined
                        onClick={() => handleAddModelGroup()}
                      />
                    )
                  }
                  {modelGroups.length > 1 && (
                    <MinusCircleOutlined
                      onClick={() => handleRemoveModelGroup(index)}
                    />
                  )}

                </Space>
              </Form.Item>
              <Form.Item
                label={t(p("modelDesc"))}
                name={["modelArray",index, "desc"]}
              >
                {versionIndex !== -1 ? modelVersionOptions[versionIndex]?.desc : ""}
              </Form.Item>
            </>
          );
        })
        }

        <Divider orientation="left" orientationMargin="0">{t(p("resource"))}</Divider>
        <Form.Item
          label={t(p("account"))}
          name="account"
          rules={[{ required: true }]}
        >
          <AccountSelector
            cluster={clusterId}
            onChange={(value) => {
              setSelectedAccountName(value);
            }}
            onReload={refetchAssociatedResourceDetails}
          />
        </Form.Item>

        <Form.Item
          label={t(p("partition"))}
          name="partition"
          rules={[{ required: true }]}
          dependencies={["account"]}
        >
          <Select
            disabled={!currentPartitionInfo}
            options={filteredClusterInfo
              ? filteredClusterInfo.partitions.map((x) => ({ label: x.name, value: x.name }))
              : []
            }
            onChange={handlePartitionChange}
            loading={isAssociatedResourceDetailsLoading}
            placeholder={isAssociatedResourceDetailsLoading ? t(p("partitionsLoading")) : t(p("noAssignedPartition"))}
          />
        </Form.Item>
        <Form.Item
          label={t(p("nodeCount"))}
          name="nodeCount"
          dependencies={["partition"]}
          rules={[
            {
              required: true,
              type: "integer",
            },
          ]}
        >
          <InputNumber
            min={1}
            max={undefined}
            {...inputNumberFloorConfig}
          />
        </Form.Item>
        {
          currentPartitionInfo?.gpus ? (
            <Form.Item
              label={t(p("gpuCount"))}
              name="gpuCount"
              dependencies={["partition"]}
              rules={[
                {
                  required: true,
                  type: "integer",
                  // 单机最多8张卡
                  max: 8,
                  validator:  (_, value) => {
                    const nodeCount = form.getFieldValue("nodeCount") || 0;
                    if (currentPartitionInfo
    && currentPartitionInfo.gpus > 0
    && (nodeCount * value > currentPartitionInfo.gpus)) {
                      return Promise.reject(new Error("Total GPUs exceed the available GPUs in the partition"));
                    }
                    return Promise.resolve();
                  },
                },
              ]}
            >
              <InputNumber
                min={1}
                max={8}
                {...inputNumberFloorConfig}
              />
            </Form.Item>
          ) : (
            <Form.Item
              label={t(p("coreCount"))}
              name="coreCount"
              dependencies={["partition"]}
              rules={[
                { required: true,
                  type: "integer",
                  validator: (_, value) => {
                    const nodeCount = form.getFieldValue("nodeCount") || 0;
                    if (currentPartitionInfo && (nodeCount * value > currentPartitionInfo.cores)) {
                      return Promise.reject(new Error("Total cores exceed the available cores in the partition"));
                    }
                    return Promise.resolve();
                  },
                },
              ]}
            >
              <InputNumber
                min={1}
                {...inputNumberFloorConfig}
              />
            </Form.Item>
          )
        }
        <Form.Item label={t(p("maxTime"))} rules={[{ required: true }]} style={{ marginBottom:0 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <Form.Item
              name="isUnlimitedTime"
              valuePropName="checked"
              style={{ display: "inline-block", marginRight: 8 }}
            >
              <Checkbox onChange={() =>
                form.setFieldsValue({ maxTime: 24 })
              }
              >
                {t(pInfer("unlimitedTime"))}
              </Checkbox>
            </Form.Item>
            {
              !isUnlimitedTime ? (
                <Form.Item name="maxTime" rules={[{ required: true }]}>
                  <AfterInputNumber
                    min={1}
                    step={1}
                    precision={0}
                    theme={theme}
                    addonAfter={
                      (
                        <Select
                          style={{ flex: "0 1 auto" }}
                          value={maxTimeUnitValue}
                          onChange={(value) => setMaxTimeUnitValue(value)}
                        >
                          <Select.Option value="min">{t(p("min"))}</Select.Option>
                          <Select.Option value="hour">{t(p("hour"))}</Select.Option>
                          <Select.Option value="day">{t(p("day"))}</Select.Option>
                        </Select>
                      )
                    }
                  />
                </Form.Item>
              ) : null
            }
          </div>
        </Form.Item>
        <Row>
          {
            currentPartitionInfo?.gpus
              ?
              (
                <Col span={12} sm={6}>
                  <Form.Item label={t(p("totalGpus"))}>
                    {nodeCount * gpuCount}
                  </Form.Item>
                </Col>
              ) : null
          }
          <Col span={12} sm={6}>
            <Form.Item label={t(p("totalCpus"))}>
              {coreCountSum}
            </Form.Item>
          </Col>
          <Col span={12} sm={6}>
            <Form.Item label={t(p("totalMem"))}>
              {memoryDisplay}
            </Form.Item>
          </Col>
        </Row>
        {
          <>
            <Divider orientation="left" orientationMargin="0" plain>{t(p("runningSetting"))}</Divider>
            <Form.Item label={t(p("command"))} name="command" rules={[{ required: true }]}>
              <Input.TextArea minLength={3} />
            </Form.Item>
          </>
        }
      </Spin>
      <Form.Item>
        <Button
          onClick={() => router.push(`/jobs/${clusterId}/createApps`)}
          style={{ marginRight: "10px" }}
        >
          {t("button.cancelButton")}
        </Button>
        <Button
          type="primary"
          htmlType="submit"
          loading={inferenceJobMutation.isLoading}
        >
          {t("button.submitButton")}
        </Button>
      </Form.Item>
    </Form>
  );
};
