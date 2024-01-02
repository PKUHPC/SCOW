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
import { App, Button, Col, Divider, Form, Input, InputNumber, Row, Select, Space, Spin } from "antd";
import { Rule } from "antd/es/form";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AccountSelector } from "src/components/AccountSelector";
import { AppCustomAttribute } from "src/server/trpc/route/jobs/apps";
import { formatSize } from "src/utils/format";
import { trpc } from "src/utils/trpc";

interface Props {
  appId?: string;
  appName?: string;
  appImage?: {
    name: string;
    tag: string;
  };
  attributes: AppCustomAttribute[];
  appComment?: I18nStringType;
  clusterId: string;
  clusterInfo: ClusterConfig;
  isTraining?: boolean;
}

interface FixedFormFields {
  appJobName: string;
  algorithm: { name: number, version: number };
  image: any;
  dataset: { name: number, version: number };
  partition: string | undefined;
  nodeCount: number;
  coreCount: number;
  gpuCount: number | undefined;
  account: string;
  maxTime: number;
}

interface CustomFormFileds {
  customeFields: {[key: string]: number | string | undefined};
}
type FormFields = CustomFormFileds & FixedFormFields;

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
}


// 生成默认应用名称，命名规则为"当前应用名-年月日-时分秒"
const genAppJobName = (appName: string): string => {
  return `${appName}-${dayjs().format("YYYYMMDD-HHmmss")}`;
};

const initialValues = {
  nodeCount: 1,
  coreCount: 1,
  gpuCount: 1,
  maxTime: 60,
} as Partial<FormFields>;

const inputNumberFloorConfig = {
  formatter: (value: number | undefined) => `${Math.floor(value ?? 0)}`,
  parser: (value: string | undefined) => Math.floor(value ? +value : 0),
};


export const LaunchAppForm = (props: Props) => {

  const { clusterId, appName, clusterInfo, isTraining = false, appId, appImage, attributes } = props;

  const { message } = App.useApp();

  const router = useRouter();

  const [form] = Form.useForm<FormFields>();

  const [currentPartitionInfo, setCurrentPartitionInfo] = useState<Partition | undefined>();

  const isPublicDataset = Form.useWatch(["dataset", "type"], form) === "public";
  const isPublicAlgorithm = Form.useWatch(["algorithm", "type"], form) === "public";

  const selectedDataset = Form.useWatch(["dataset", "name"], form);

  const selectedAlgorithm = Form.useWatch(["algorithm", "name"], form);

  const { data: datasets, isLoading: isDatasetsLoading } = trpc.dataset.list.useQuery({
    isShared: isPublicDataset, clusterId,
  });

  const { data: datasetVersions, isLoading: isDatasetVersionsLoading } = trpc.dataset.versionList.useQuery({
    datasetId: selectedDataset, isShared: isPublicDataset,
  }, { enabled: selectedDataset !== undefined });

  const datasetOptions = useMemo(() => {
    return datasets?.items.map((x) => ({ label: `${x.name}(${x.owner})`, value: x.id }));
  }, [datasets]);

  const datasetVersionOptions = useMemo(() => {
    return datasetVersions?.items.map((x) => ({ label: x.versionName, value: x.id }));
  }, [datasetVersions]);

  const { data: algorithms, isLoading: isAlgorithmLoading } = trpc.algorithm.getAlgorithms.useQuery(
    {
      clusterId,
      isPublic: isPublicAlgorithm,
    });

  const { data:algorithmVersions, isLoading: isAlgorithmVersionsLoading } =
  trpc.algorithm.getAlgorithmVersions.useQuery({ algorithmId: selectedAlgorithm, isPublic: isPublicAlgorithm }, {
    enabled: selectedAlgorithm !== undefined });


  const algorithmOptions = useMemo(() => {
    return algorithms?.items.map((x) => ({ label: x.name, value: x.id }));
  }, [datasets]);

  const algorithmVersionOptions = useMemo(() => {
    return algorithmVersions?.items.map((x) => ({ label: x.versionName, value: x.id }));
  }, [algorithmVersions]);

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
    if (item.type === "SELECT") console.log(item.defaultValue, selectOptions[0].value);
    const inputItem = item.type === "NUMBER" ?
      (<InputNumber placeholder={getI18nConfigCurrentText(placeholder, undefined)} />)
      : item.type === "TEXT" ? (<Input placeholder={getI18nConfigCurrentText(placeholder, undefined)} />)
        : (
          <Select
            options={selectOptions.map((x) => ({
              label: getI18nConfigCurrentText(x.label, undefined), value: x.value }))}
            placeholder={getI18nConfigCurrentText(placeholder, undefined)}
          />
        );

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
        name={["customeFields", item.name]}
        rules={rules}
        initialValue={initialValue}
      >
        {inputItem}
      </Form.Item>
    );
  }), [attributes, currentPartitionInfo]);

  useEffect(() => {
    setCurrentPartitionInfo(clusterInfo?.partitions[0]);
    form.setFieldsValue({
      partition: clusterInfo?.partitions[0].name,
      appJobName: genAppJobName(appName ?? "trainJobs"),
    });
  }, [clusterInfo]);

  const createAppSessionMutation = trpc.jobs.createAppSession.useMutation({
    onSuccess() {
      message.success("创建成功");
      router.push(`/jobs/${clusterId}/runningJobs`);
    },
    onError(e) {
      message.error(`创建失败: ${e.message}`);
    },
  },
  );

  return (
    <Form
      form={form}
      initialValues={{
        ... initialValues,
      }}
      onFinish={async () => {
        const values = await form.validateFields();
        const {
          appJobName, algorithm, dataset, account, partition, nodeCount, coreCount, gpuCount, maxTime } = values;
        const customFormKeyValue: CustomFormFileds = { customeFields: {} };
        attributes.forEach((customFormAttribute) => {
          const customFormKey = customFormAttribute.name;
          customFormKeyValue.customeFields[customFormKey] = values.customeFields[customFormKey];
        });
        createAppSessionMutation.mutate({
          clusterId,
          appId: appId!,
          appJobName,
          algorithm: algorithm.version,
          image: `${appImage!.name}:${appImage!.tag}`,
          dataset: dataset.version,
          account: account,
          partition: partition,
          nodeCount: nodeCount,
          coreCount: coreCount,
          gpuCount: gpuCount,
          maxTime: maxTime,
          customAttributes: customFormKeyValue.customeFields,
        });
      }}
    >
      <Spin spinning={createAppSessionMutation.isLoading} tip="loading">
        <Form.Item name="appJobName" label="应用名称" rules={[{ required: true }, { max: 50 }]}>
          <Input />
        </Form.Item>
        <Form.Item label="算法" required>
          <Space>
            <Form.Item name={["algorithm", "type"]} rules={[{ required: true }]} noStyle>
              <Select
                style={{ minWidth: 100 }}
                onChange={() => {
                  form.setFieldsValue({ algorithm: { name: undefined, version: undefined } });
                }}
                options={
                  [
                    {
                      value: "private",
                      label: "我的算法",
                    },
                    {
                      value: "public",
                      label: "公共算法",
                    },
                  ]
                }
              />
            </Form.Item>
            <Form.Item name={["algorithm", "name"]} rules={[{ required: true }]} noStyle>
              <Select style={{ minWidth: 100 }} loading={isAlgorithmLoading} options={algorithmOptions} />
            </Form.Item>
            <Form.Item name={["algorithm", "version"]} rules={[{ required: true }]} noStyle>
              <Select
                style={{ minWidth: 100 }}
                loading={isAlgorithmVersionsLoading && selectedAlgorithm !== undefined}
                options={algorithmVersionOptions}
              />
            </Form.Item>
          </Space>
        </Form.Item>
        {isTraining && (
          <Form.Item label="镜像" required>
            <Space>
              <Form.Item name={["image", "type"]} rules={[{ required: true }]} noStyle>
                <Select style={{ minWidth: 100 }} />
              </Form.Item>
              <Form.Item name={["image", "name"]} rules={[{ required: true }]} noStyle>
                <Select style={{ minWidth: 100 }} />
              </Form.Item>
            </Space>
          </Form.Item>
        )}
        <Form.Item label="数据集" required>
          <Space>
            <Form.Item name={["dataset", "type"]} rules={[{ required: true }]} noStyle>
              <Select
                style={{ minWidth: 120 }}
                loading={isDatasetsLoading}
                onChange={() => {
                  form.setFieldsValue({ dataset: { name: undefined, version: undefined } });
                }}
                options={
                  [
                    {
                      value: "private",
                      label: "我的数据集",
                    },
                    {
                      value: "public",
                      label: "公共数据集",
                    },

                  ]
                }
              />
            </Form.Item>
            <Form.Item name={["dataset", "name"]} rules={[{ required: true }]} noStyle>
              <Select
                style={{ minWidth: 100 }}
                onChange={() => {
                  form.setFieldValue(["dataset", "version"], undefined);
                }}
                options={datasetOptions}
              />
            </Form.Item>
            <Form.Item name={["dataset", "version"]} rules={[{ required: true }]} noStyle>
              <Select
                style={{ minWidth: 100 }}
                loading={isDatasetVersionsLoading && selectedDataset !== undefined}
                options={datasetVersionOptions}
              />
            </Form.Item>
          </Space>
        </Form.Item>
        <Divider orientation="left" orientationMargin="0" plain>资源</Divider>
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
            { required: true, type: "integer",
              max: currentPartitionInfo?.nodes,
            },
          ]}
        >
          <InputNumber
            min={1}
            max={currentPartitionInfo?.nodes}
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
                  max: currentPartitionInfo?.gpus / currentPartitionInfo.nodes,
                },
              ]}
            >
              <InputNumber
                min={1}
                max={currentPartitionInfo?.gpus / currentPartitionInfo.nodes}
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
                  max: currentPartitionInfo ?
                    currentPartitionInfo.cores / currentPartitionInfo.nodes : undefined },
              ]}
            >
              <InputNumber
                min={1}
                max={currentPartitionInfo ?
                  currentPartitionInfo.cores / currentPartitionInfo.nodes : undefined }
                {...inputNumberFloorConfig}
              />
            </Form.Item>
          )
        }
        <Form.Item label="最长运行时间" name="maxTime" rules={[{ required: true }]}>
          <InputNumber min={1} step={1} addonAfter="分钟" />
        </Form.Item>
        {customFormItems}
        <Row>
          {
            currentPartitionInfo?.gpus
              ?
              (
                <Col span={12} sm={6}>
                  {/* <Form.Item label={t(p("totalGpuCount"))}> */}
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
              <Form.Item label="运行参数">
                <Form.List
                  name="keyValues"
                  initialValue={[{ key: "", value: "" }]} // 初始化一个空的键值对
                >
                  {(fields, { add, remove }) => (
                    <>
                      {fields.map(({ key, name, ...restField }, index) => (
                        <Space key={key} style={{ display: "flex", marginBottom: 8 }} align="baseline">
                          <Form.Item
                            {...restField}
                            name={[name, "key"]}
                            rules={[{ required: true, message: "请输入键" }]}
                          >
                            <Input placeholder="键" />
                          </Form.Item>
                          <span style={{ lineHeight: "32px" }}>=</span>
                          <Form.Item
                            {...restField}
                            name={[name, "value"]}
                            rules={[{ required: true, message: "请输入值" }]}
                          >
                            <Input placeholder="值" />
                          </Form.Item>
                          {fields.length > 1 ? (
                            <MinusCircleOutlined onClick={() => remove(name)} />
                          ) : null}
                          {index === fields.length - 1 ? (
                            <PlusOutlined onClick={() => add()} />
                          ) : null}
                        </Space>
                      ))}
                    </>
                  )}
                </Form.List>
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