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

import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { I18nStringType } from "@scow/config/build/i18n";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Button, Checkbox, Col,
  Divider, Form, Input, InputNumber, Row, Select, Space, Spin, Typography } from "antd";
import { Rule } from "antd/es/form";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AccountSelector } from "src/components/AccountSelector";
import { FileSelectModal } from "src/components/FileSelectModal";
import { AlgorithmInterface, AlgorithmVersionInterface } from "src/models/Algorithm";
import { Status } from "src/models/Image";
import { ModelInterface, ModelVersionInterface } from "src/models/Model";
import { DatasetInterface } from "src/server/trpc/route/dataset/dataset";
import { DatasetVersionInterface } from "src/server/trpc/route/dataset/datasetVersion";
import { AppCustomAttribute, CreateAppInput } from "src/server/trpc/route/jobs/apps";
import { FrameworkType, TrainJobInput } from "src/server/trpc/route/jobs/jobs";
import { formatSize } from "src/utils/format";
import { parseBooleanParam } from "src/utils/parse";
import { trpc } from "src/utils/trpc";

import { setEntityInitData, useDataOptions, useDataVersionOptions } from "./hooks";

interface Props {
  appId?: string;
  appName?: string;
  appImage?: {
    name: string;
    tag: string;
  };
  attributes?: AppCustomAttribute[];
  appComment?: I18nStringType;
  clusterId: string;
  clusterInfo: ClusterConfig;
  isTraining?: boolean;
  createAppParams?: CreateAppInput
  trainJobInput?: TrainJobInput
}

interface FixedFormFields {
  appJobName: string;
  showAlgorithm: boolean;
  algorithm: { type: AccessibilityType, name: number, version: number };
  useCustomImage: boolean;
  image: { type: AccessibilityType, name: number };
  remoteImageUrl: string | undefined;
  framework: FrameworkType | undefined;
  startCommand?: string;
  showDataset: boolean;
  dataset: { type: AccessibilityType, name: number, version: number };
  showModel: boolean;
  model: { type: AccessibilityType, name: number, version: number };
  mountPoints: string[] | undefined;
  partition: string | undefined;
  coreCount: number;
  nodeCount: number;
  gpuCount: number | undefined;
  account: string;
  maxTime: number;
  command?: string;
}

interface CustomFormFields {
  customFields: {[key: string]: number | string | undefined};
}
type FormFields = CustomFormFields & FixedFormFields;

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

// 生成默认应用名称，命名规则为"当前应用名-年月日-时分秒"
const genAppJobName = (appName: string): string => {
  return `${appName}-${dayjs().format("YYYYMMDD-HHmmss")}`;
};

const initialValues = {
  nodeCount:1,
  coreCount: 1,
  gpuCount: 1,
  maxTime: 60,
} as Partial<FormFields>;

const inputNumberFloorConfig = {
  formatter: (value: number | undefined) => `${Math.floor(value ?? 0)}`,
  parser: (value: string | undefined) => Math.floor(value ? +value : 0),
};


export const LaunchAppForm = (props: Props) => {

  const { clusterId, appName, clusterInfo, isTraining = false,
    appId, attributes = [], appImage, createAppParams, trainJobInput } = props;

  const { message } = App.useApp();

  const router = useRouter();

  const [form] = Form.useForm<FormFields>();

  const [currentPartitionInfo, setCurrentPartitionInfo] = useState<Partition | undefined>();



  const showAlgorithm = Form.useWatch("showAlgorithm", form);
  const showDataset = Form.useWatch("showDataset", form);
  const showModel = Form.useWatch("showModel", form);
  const useCustomImage = Form.useWatch("useCustomImage", form);

  const isAlgorithmPrivate = Form.useWatch(["algorithm", "type"], form) === AccessibilityType.PRIVATE;
  const isDatasetPrivate = Form.useWatch(["dataset", "type"], form) === AccessibilityType.PRIVATE;
  const isModelPrivate = Form.useWatch(["model", "type"], form) === AccessibilityType.PRIVATE;

  const {
    data: datasets, dataOptions: datasetOptions, isDataLoading:  isDatasetsLoading,
  } = useDataOptions<DatasetInterface>(
    form,
    "dataset",
    trpc.dataset.list.useQuery,
    clusterId,
    (dataset) => ({ label: `${dataset.name}(${dataset.owner})`, value: dataset.id }),
  );

  const {
    dataVersions: datasetVersions,
    dataVersionOptions: datasetVersionOptions,
    isDataVersionsLoading: isDatasetVersionsLoading,
  } =
  useDataVersionOptions<DatasetVersionInterface>(
    form,
    "dataset",
    trpc.dataset.versionList.useQuery,
    (x) => ({ label: x.versionName, value: x.id }),
  );

  const {
    data: algorithms, dataOptions: algorithmOptions, isDataLoading:  isAlgorithmLoading,
  } = useDataOptions<AlgorithmInterface>(
    form,
    "algorithm",
    trpc.algorithm.getAlgorithms.useQuery,
    clusterId,
    (x) => ({ label:`${x.name}(${x.owner})`, value: x.id }),
  );

  const {
    dataVersions: algorithmVersions,
    dataVersionOptions: algorithmVersionOptions,
    isDataVersionsLoading: isAlgorithmVersionsLoading,
  } =
  useDataVersionOptions<AlgorithmVersionInterface>(
    form,
    "algorithm",
    trpc.algorithm.getAlgorithmVersions.useQuery,
    (x) => ({ label: x.versionName, value: x.id }),
  );

  const { data: models, dataOptions: modelOptions, isDataLoading:  isModelsLoading } = useDataOptions<ModelInterface>(
    form,
    "model",
    trpc.model.list.useQuery,
    clusterId,
    (x) => ({ label: `${x.name}(${x.owner})`, value: x.id }),
  );

  const {
    dataVersions: modelVersions,
    dataVersionOptions: modelVersionOptions,
    isDataVersionsLoading: isModelVersionsLoading,
  } =
  useDataVersionOptions<ModelVersionInterface>(
    form,
    "model",
    trpc.model.versionList.useQuery,
    (x) => ({ label: x.versionName, value: x.id }),
  );

  const imageType = Form.useWatch(["image", "type"], form);
  const selectedImage = Form.useWatch(["image", "name"], form);
  const remoteImageInput = Form.useWatch("remoteImageUrl", form);
  const customImage = remoteImageInput || selectedImage;

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

  const nodeCount = Form.useWatch("nodeCount", form) as number;

  const coreCount = Form.useWatch("coreCount", form) as number;

  const gpuCount = Form.useWatch("gpuCount", form) as number;

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
    const partitionInfo = clusterInfo
      ? clusterInfo.partitions.find((x) => x.name === partition)
      : undefined;
    if (!!partitionInfo?.gpus) {
      form.setFieldValue("gpuCount", 1);
    } else {
      form.setFieldValue("coreCount", 1);
    }
    setCurrentPartitionInfo(partitionInfo);

  };

  const customFormItems = useMemo(() => attributes.map((item, index) => {
    const rules: Rule[] = item.type === "NUMBER"
      ? [{ type: "integer" }, { required: item.required }]
      : [{ required: item.required }];

    const placeholder = item.placeholder ?? "";

    // 筛选选项：若没有配置requireGpu直接使用，配置了requireGpu项使用与否则看改分区有无GPU
    const selectOptions = item.select.filter((x) => !x.requireGpu || (x.requireGpu && currentPartitionInfo?.gpus));
    const initialValue = item.type === "SELECT" ? (item.defaultValue ?? selectOptions[0].value) : item.defaultValue;

    let inputItem: JSX.Element;

    // 特殊处理某些应用的工作目录需要使用文件选择器
    if (item.name === "workingDir") {
      inputItem = (
        <Input
          placeholder={getI18nConfigCurrentText(placeholder, undefined)}
          prefix={
            (
              <FileSelectModal
                allowedFileType={["DIR"]}
                onSubmit={(path: string) => {
                  form.setFieldsValue({
                    customFields: {
                      [item.name]: path,
                    },
                  });
                  form.validateFields([["customFields", item.name]]);
                }}
                clusterId={clusterId ?? ""}
              />
            )
          }
        />
      );
    } else {
      inputItem = item.type === "NUMBER" ?
        (<InputNumber placeholder={getI18nConfigCurrentText(placeholder, undefined)} />)
        : item.type === "TEXT" ? (<Input placeholder={getI18nConfigCurrentText(placeholder, undefined)} />)
          : (
            <Select
              options={selectOptions.map((x) => ({
                label: getI18nConfigCurrentText(x.label, undefined), value: x.value }))}
              placeholder={getI18nConfigCurrentText(placeholder, undefined)}
            />
          );
    }

    // 判断是否配置了requireGpu选项
    if (item.type === "SELECT" && item.select.find((i) => i.requireGpu !== undefined)) {
      const preValue = form.getFieldValue(item.name);

      if (preValue) {
        // 切换分区后看之前的版本是否还存在，若不存在，则选择版本的select的值置空
        const optionsContained = selectOptions.find((i) => i.value === preValue);
        if (!optionsContained) form.setFieldValue(item.name, null);
      }
    }

    return (
      <Form.Item
        key={`${item.name}+${index}`}
        label={getI18nConfigCurrentText(item.label, undefined) ?? undefined}
        name={["customFields", item.name]}
        rules={rules}
        initialValue={initialValue}
      >
        {inputItem}
      </Form.Item>
    );
  }), [attributes, currentPartitionInfo]);


  useEffect(() => {
    // 处理算法相关数据
    const inputParams = trainJobInput || createAppParams;
    if (inputParams && inputParams.algorithm !== undefined
      && inputParams.isAlgorithmPrivate !== undefined) {
      const { isAlgorithmPrivate, algorithm: algorithmId } = inputParams;
      // 如果用户修改表单值，则不再初始化数据
      if (!form.isFieldsTouched(["showAlgorithm",
        ["algorithm", "type"], ["algorithm", "name"],
        ["algorithm", "version"]])) {
        setEntityInitData<AlgorithmVersionInterface, AlgorithmInterface>(
          "algorithm",
          algorithms,
          algorithmVersions,
          algorithmId,
          isAlgorithmPrivate,
          form,
          "showAlgorithm",
        );
      }
    }
  }, [createAppParams, trainJobInput, algorithms, algorithmVersions, form]);

  useEffect(() => {
    // 处理数据集相关数据
    const inputParams = trainJobInput || createAppParams;
    if (inputParams && inputParams.dataset !== undefined
      && inputParams.isDatasetPrivate !== undefined) {
      const { isDatasetPrivate, dataset: datasetId } = inputParams;
      // 如果用户修改表单值，则不再初始化数据
      if (!form.isFieldsTouched(["showDataset",
        ["dataset", "type"], ["dataset", "name"],
        ["dataset", "version"]])) {
        setEntityInitData<DatasetVersionInterface, DatasetInterface>(
          "dataset",
          datasets,
          datasetVersions,
          datasetId,
          isDatasetPrivate,
          form,
          "showDataset",
        );
      }
    }
  }, [ createAppParams, trainJobInput, datasets, datasetVersions, form]);

  useEffect(() => {
    // 处理模型相关数据
    const inputParams = trainJobInput || createAppParams;
    if (inputParams && inputParams.model !== undefined
      && inputParams.isModelPrivate !== undefined) {
      const { isModelPrivate, model: modelId } = inputParams;
      // 如果用户修改表单值，则不再初始化数据
      if (!form.isFieldsTouched(["showModel",
        ["model", "type"], ["model", "name"],
        ["model", "version"]])) {
        setEntityInitData<ModelVersionInterface, ModelInterface>(
          "model",
          models,
          modelVersions,
          modelId,
          isModelPrivate,
          form,
          "showModel",
        );
      }
    }
  }, [createAppParams, trainJobInput, models, modelVersions, form]);


  // 处理镜像
  useEffect(() => {
    const inputParams = trainJobInput || createAppParams;
    if (inputParams && (inputParams.remoteImageUrl || inputParams.image)) {
      if (!form.isFieldsTouched([
        "useCustomImage",
        "startCommand",
        "remoteImageUrl",
        ["image", "type"],
        ["image", "name"],
      ])) {
        form.setFieldValue("useCustomImage", true);
        if ("startCommand" in inputParams) {
          form.setFieldValue("startCommand", inputParams.startCommand);
        }
        if (!!images?.items?.length) {
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
  }, [createAppParams, trainJobInput, images, form]);


  useEffect(() => {
    setCurrentPartitionInfo(clusterInfo?.partitions[0]);
    const inputParams = trainJobInput || createAppParams;
    if (!inputParams) {
      form.setFieldsValue({
        partition: clusterInfo?.partitions[0]?.name,
        appJobName: genAppJobName(appName ?? "trainJobs"),
      });
    } else {
      const { account, partition, gpuCount, coreCount, maxTime, mountPoints, nodeCount } = inputParams;
      const workingDir = "workingDirectory" in inputParams ? inputParams.workingDirectory : undefined;
      const customAttributes = "customAttributes" in inputParams ? inputParams.customAttributes : {};
      const command = "command" in inputParams ? inputParams.command : undefined;
      const framework = "framework" in inputParams ? inputParams.framework : undefined;
      form.setFieldsValue({
        mountPoints,
        customFields: {
          ...customAttributes,
          workingDir,
        },
        nodeCount,
        framework,
        account,
        partition,
        gpuCount,
        coreCount,
        maxTime,
        appJobName: genAppJobName(appName ?? "trainJobs"),
        command,
      });
    }

  }, [createAppParams, trainJobInput, clusterInfo]);

  const createAppSessionMutation = trpc.jobs.createAppSession.useMutation({
    onSuccess() {
      message.success("创建成功");
      router.push(`/jobs/${clusterId}/runningJobs`);
    },
    onError(e) {
      message.error(`创建失败: ${e.message}`);
    },
  });

  const trainJobMutation = trpc.jobs.trainJob.useMutation({
    onSuccess() {
      message.success("提交训练成功");
      router.push(`/jobs/${clusterId}/runningJobs`);
    },
    onError(e) {
      message.error(`提交训练失败: ${e.message}`);
    },
  });

  return (
    <Form
      form={form}
      initialValues={{
        ... initialValues,
      }}
      onFinish={async () => {

        const { appJobName, algorithm, dataset, image, remoteImageUrl, framework, startCommand, model,
          mountPoints, account, partition, coreCount,
          gpuCount, maxTime, command, customFields } = await form.validateFields();

        if (isTraining) {
          await trainJobMutation.mutateAsync({
            clusterId,
            trainJobName: appJobName,
            isAlgorithmPrivate,
            algorithm: algorithm?.version,
            image: image?.name,
            remoteImageUrl,
            framework,
            isDatasetPrivate,
            dataset: dataset?.version,
            isModelPrivate,
            model: model?.version,
            mountPoints,
            account: account,
            partition: partition,
            nodeCount: nodeCount,
            coreCount: gpuCount ?
              gpuCount * Math.floor(currentPartitionInfo!.cores / currentPartitionInfo!.gpus) :
              coreCount,
            gpuCount: gpuCount,
            maxTime: maxTime,
            memory: memorySize,
            command: command || "",
            gpuType: currentPartitionInfo!.gpuType,
          });
        } else {
          let workingDirectory: string | undefined;
          const customFormKeyValue: CustomFormFields = { customFields: {} };
          attributes.forEach((customFormAttribute) => {
            const customFormKey = customFormAttribute.name;
            if (customFormKey === "workingDir") {
              workingDirectory = customFields[customFormKey]?.toString();
            }
            customFormKeyValue.customFields[customFormKey] = customFields[customFormKey];
          });

          createAppSessionMutation.mutate({
            clusterId,
            appId: appId!,
            appJobName,
            isAlgorithmPrivate,
            algorithm: algorithm?.version,
            image: image?.name,
            remoteImageUrl,
            startCommand,
            isDatasetPrivate,
            dataset: dataset?.version,
            isModelPrivate,
            model: model?.version,
            mountPoints,
            account: account,
            partition: partition,
            nodeCount: nodeCount,
            coreCount: gpuCount ?
              gpuCount * Math.floor(currentPartitionInfo!.cores / currentPartitionInfo!.gpus) :
              coreCount,
            gpuCount: gpuCount,
            maxTime: maxTime,
            memory: memorySize,
            workingDirectory,
            customAttributes: customFormKeyValue.customFields,
          });
        }
      }
      }

    >
      <Spin spinning={createAppSessionMutation.isLoading || trainJobMutation.isLoading} tip="loading">
        <Form.Item name="appJobName" label="名称" rules={[{ required: true }, { max: 50 }]}>
          <Input />
        </Form.Item>
        <Divider orientation="left" orientationMargin="0">{isTraining ? "训练配置" : "应用配置"}</Divider>
        {!isTraining && (
          <Form.Item
            label="启动镜像"
            help={ useCustomImage &&
            <Typography.Text type="danger">{`请选择镜像或填写远程镜像地址，确保镜像安装了${appName}应用，并指定启动命令`}</Typography.Text>
            }
          >
            <Space>
              <strong>
                {remoteImageInput ? remoteImageInput : selectedImage
                  ? imageOptions?.find((x) => x.value === selectedImage)?.label
                  : appImage ? `${appImage?.name}:${appImage?.tag}` : "-"}
              </strong>
              <Form.Item
                noStyle
                name="useCustomImage"
                valuePropName="checked"
              >
                <Checkbox onChange={() => {
                  form.setFieldsValue({
                    image: { type: undefined, name: undefined }, remoteImageUrl: undefined, startCommand: undefined,
                  });
                }}
                >使用自定义镜像</Checkbox>
              </Form.Item>
            </Space>
          </Form.Item>
        )}
        {
          (isTraining || useCustomImage) && (
            <>
              <Form.Item label="镜像">
                <Space>
                  <Form.Item name={["image", "type"]} noStyle>
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
                            label: "我的镜像",
                          },
                          {
                            value:  AccessibilityType.PUBLIC,
                            label: "公共镜像",
                          },
                        ]
                      }
                    />
                  </Form.Item>
                  <Form.Item
                    name={["image", "name"]}
                    rules={[({ getFieldValue }) => ({
                      validator() {
                        if (getFieldValue(["image", "name"]) || getFieldValue("remoteImageUrl")) {
                          return Promise.resolve();
                        }
                        return Promise.reject(new Error("请选择镜像或填写远程镜像地址"));
                      },
                    })]}
                    dependencies={["remoteImageUrl"]}
                    noStyle
                  >
                    <Select
                      style={{ minWidth: 100 }}
                      allowClear
                      onChange={() => {
                        form.setFieldValue("startCommand", undefined);
                      }}
                      loading={isImagesLoading && isImagePublic !== undefined}
                      options={imageOptions}
                    />
                  </Form.Item>
                </Space>
              </Form.Item>
              <Form.Item
                label="远程镜像地址"
                name="remoteImageUrl"
                rules={[({ getFieldValue }) => ({
                  validator() {
                    if (getFieldValue(["image", "name"]) || getFieldValue("remoteImageUrl")) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error("请选择镜像或填写远程镜像地址"));
                  },
                })]}
                dependencies={[["image", "name"]]}
              >
                <Input placeholder="请输入远程镜像地址" />
              </Form.Item>
              {/* 分布式训练时，需要指定训练框架 */}
              {(isTraining && nodeCount > 1) ? (
                <>
                  {/* 手动选择算法框架，下拉框只有 tensorflow, pytorch */}
                  <Form.Item
                    label="分布式训练框架"
                    name="framework"
                    rules={[{ required: true }]}
                  >
                    <Select options={
                      [
                        {
                          value: "tensorflow",
                          label: "Tensorflow",
                        },
                        {
                          value: "pytorch",
                          label: "Pytorch",
                        },
                      ]
                    }
                    >
                    </Select>
                  </Form.Item>
                </>
              ) : null}
              {(customImage && !isTraining) ? (
                <Form.Item
                  label="启动命令"
                  name="startCommand"
                  rules={[{ required: customImage !== undefined }]}
                  dependencies={["image", "name"]}
                >
                  <Input placeholder="运行镜像里程序的启动命令" />
                </Form.Item>
              ) : null }
            </>
          )
        }

        {
          customFormItems.filter((item) => item?.key?.includes("workingDir"))
        }
        <Form.List name="mountPoints">
          {(fields, { add, remove }) => (
            <>
              {fields.map((field, index) => (
                <Space key={field.key} style={{ display: "flex", marginBottom: 8 }} align="baseline">
                  <Form.Item
                    {...field}
                    label={`挂载点-${index + 1}`}
                    rules={[
                      { required: true, message: "请提供挂载点地址" },
                      // 添加的自定义校验器以确保挂载点不重复
                      ({ getFieldValue }) => ({
                        validator(_, value: string) {

                          const currentValueNormalized = value.replace(/\/+$/, "");

                          const mountPoints: string[] = getFieldValue("mountPoints").map((mountPoint: string) =>
                            mountPoint.replace(/\/+$/, ""),
                          );

                          const currentIndex = mountPoints.findIndex((point) => point === currentValueNormalized);

                          const otherMountPoints = mountPoints.filter((_, idx) => idx !== currentIndex);
                          if (otherMountPoints.includes(currentValueNormalized)) {
                            return Promise.reject(new Error("挂载点地址不能重复"));
                          }
                          return Promise.resolve();
                        },
                      }),
                    ]}
                  >
                    <Input
                      placeholder="选择挂载点"
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
              ))}
              <Form.Item>
                <Button
                  type="dashed"
                  onClick={() => add()}
                  icon={<PlusOutlined />}
                >
          添加挂载点
                </Button>
              </Form.Item>
            </>
          )}
        </Form.List>
        <Divider orientation="left" orientationMargin="0">添加算法/数据集/模型</Divider>
        <Form.Item label="添加类型" style={{ marginBottom: 0 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <Form.Item
              name="showAlgorithm"
              valuePropName="checked"
              style={{ display: "inline-block", marginRight: 8 }}
            >
              <Checkbox onChange={() =>
                form.setFieldsValue({ algorithm: { type: undefined, name: undefined, version: undefined } })}
              >
            算法
              </Checkbox>
            </Form.Item>
            <Form.Item
              name="showDataset"
              valuePropName="checked"
              style={{ display: "inline-block", marginRight: 8 }}
            >
              <Checkbox onChange={() =>
                form.setFieldsValue({ dataset: { type: undefined, name: undefined, version: undefined } })}
              >
            数据集
              </Checkbox>
            </Form.Item>
            <Form.Item
              name="showModel"
              valuePropName="checked"
              style={{ display: "inline-block", marginRight: 8 }}
            >
              <Checkbox onChange={() =>
                form.setFieldsValue({ model: { type: undefined, name: undefined, version: undefined } })}
              >
            模型
              </Checkbox>
            </Form.Item>
          </div>
        </Form.Item>
        {
          showAlgorithm ? (
            <Form.Item label="算法">
              <Space>
                <Form.Item name={["algorithm", "type"]} noStyle>
                  <Select
                    allowClear
                    style={{ minWidth: 100 }}
                    onChange={() => {
                      form.setFieldsValue({ algorithm: { name: undefined, version: undefined } });
                    }}
                    options={
                      [
                        {
                          value: AccessibilityType.PRIVATE,
                          label: "我的算法",
                        },
                        {
                          value:  AccessibilityType.PUBLIC,
                          label: "公共算法",
                        },
                      ]
                    }
                  />
                </Form.Item>
                <Form.Item name={["algorithm", "name"]} noStyle>
                  <Select
                    allowClear
                    style={{ minWidth: 100 }}
                    onChange={() => {
                      form.setFieldValue(["algorithm", "version"], undefined);
                    }}
                    loading={isAlgorithmLoading}
                    options={algorithmOptions}
                  />
                </Form.Item>
                <Form.Item name={["algorithm", "version"]} noStyle>
                  <Select
                    allowClear
                    style={{ minWidth: 100 }}
                    loading={isAlgorithmVersionsLoading}
                    options={algorithmVersionOptions}
                  />
                </Form.Item>
              </Space>
            </Form.Item>
          ) : null
        }

        {
          showDataset ? (
            <Form.Item label="数据集">
              <Space>
                <Form.Item name={["dataset", "type"]} noStyle>
                  <Select
                    allowClear
                    style={{ minWidth: 120 }}
                    onChange={() => {
                      form.setFieldsValue({ dataset: { name: undefined, version: undefined } });
                    }}
                    options={
                      [
                        {
                          value: AccessibilityType.PRIVATE,
                          label: "我的数据集",
                        },
                        {
                          value: AccessibilityType.PUBLIC,
                          label: "公共数据集",
                        },

                      ]
                    }
                  />
                </Form.Item>
                <Form.Item name={["dataset", "name"]} noStyle>
                  <Select
                    allowClear
                    style={{ minWidth: 100 }}
                    loading={isDatasetsLoading}
                    onChange={() => {
                      form.setFieldValue(["dataset", "version"], undefined);
                    }}
                    options={datasetOptions}
                  />
                </Form.Item>
                <Form.Item name={["dataset", "version"]} noStyle>
                  <Select
                    allowClear
                    style={{ minWidth: 100 }}
                    loading={isDatasetVersionsLoading}
                    options={datasetVersionOptions}
                  />
                </Form.Item>
              </Space>
            </Form.Item>
          ) : null
        }

        {
          showModel ? (
            <Form.Item label="模型">
              <Space>
                <Form.Item name={["model", "type"]} noStyle>
                  <Select
                    allowClear
                    style={{ minWidth: 100 }}
                    onChange={() => {
                      form.setFieldsValue({ model: { name: undefined, version: undefined } });
                    }}
                    options={
                      [
                        {
                          value: AccessibilityType.PRIVATE,
                          label: "我的模型",
                        },
                        {
                          value:  AccessibilityType.PUBLIC,
                          label: "公共模型",
                        },
                      ]
                    }
                  />
                </Form.Item>
                <Form.Item name={["model", "name"]} noStyle>
                  <Select
                    allowClear
                    style={{ minWidth: 100 }}
                    onChange={() => {
                      form.setFieldValue(["model", "version"], undefined);
                    }}
                    loading={isModelsLoading }
                    options={modelOptions}
                  />
                </Form.Item>
                <Form.Item name={["model", "version"]} noStyle>
                  <Select
                    allowClear
                    style={{ minWidth: 100 }}
                    loading={isModelVersionsLoading}
                    options={modelVersionOptions}
                  />
                </Form.Item>
              </Space>
            </Form.Item>
          ) : null
        }

        <Divider orientation="left" orientationMargin="0">资源</Divider>
        <Form.Item
          label="账户"
          name="account"
          rules={[{ required: true }]}
        >
          <AccountSelector cluster={clusterId} />
        </Form.Item>

        <Form.Item
          label="队列"
          name="partition"
          rules={[{ required: true }]}
        >
          <Select
            disabled={!currentPartitionInfo}
            options={clusterInfo
              ? clusterInfo.partitions.map((x) => ({ label: x.name, value: x.name }))
              : []
            }
            onChange={handlePartitionChange}
          />
        </Form.Item>
        <Form.Item
          label="节点数"
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
            max={isTraining ? undefined : 1}
            {...inputNumberFloorConfig}
          />
        </Form.Item>
        {
          currentPartitionInfo?.gpus ? (
            <Form.Item
              label="单节点GPU卡数"
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
              label="单节点CPU核心数"
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
        <Form.Item label="最长运行时间" name="maxTime" rules={[{ required: true }]}>
          <InputNumber min={1} step={1} addonAfter="分钟" />
        </Form.Item>
        {
          customFormItems.filter((item) => !item?.key?.includes("workingDir"))
        }
        <Row>
          {
            currentPartitionInfo?.gpus
              ?
              (
                <Col span={12} sm={6}>
                  <Form.Item label="总GPU数">
                    {nodeCount * gpuCount}
                  </Form.Item>
                </Col>
              ) : null
          }
          <Col span={12} sm={6}>
            <Form.Item label="总CPU数">
              {coreCountSum}
            </Form.Item>
          </Col>
          <Col span={12} sm={6}>
            <Form.Item label="总内存">
              {memoryDisplay}
            </Form.Item>
          </Col>
        </Row>
        {
          isTraining ? (
            <>
              <Divider orientation="left" orientationMargin="0" plain>运行设置</Divider>
              <Form.Item label="运行命令" name="command" rules={[{ required: true }]}>
                <Input.TextArea minLength={3} />
              </Form.Item>
            </>
          ) : null
        }
      </Spin>
      <Form.Item>
        <Button
          onClick={() => router.push(`/jobs/${clusterId}/createApps`)}
          style={{ marginRight: "10px" }}
        >
          取消
        </Button>
        <Button
          type="primary"
          htmlType="submit"
          loading={createAppSessionMutation.isLoading}
        >
          提交
        </Button>
      </Form.Item>
    </Form>
  );
};
