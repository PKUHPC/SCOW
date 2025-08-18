"use client";

import { MinusCircleOutlined, PlusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { I18nStringType } from "@scow/config/build/i18n";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Button, Checkbox, Col,
  Divider, Form, Input, InputNumber, Radio, Row, Select, Space, Spin,
  Switch } from "antd";
import { Rule } from "antd/es/form";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { usePublicConfig } from "src/app/(auth)/context";
import { AccountSelector } from "src/components/AccountSelector";
import { FileSelectModal } from "src/components/FileSelectModal";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { AlgorithmInterface, AlgorithmVersionInterface } from "src/models/Algorithm";
import { ImageType, Status } from "src/models/Image";
import { ImageSource } from "src/models/Job";
import { ModelInterface, ModelVersionInterface } from "src/models/Model";
import { DatasetInterface } from "src/server/trpc/route/dataset/dataset";
import { DatasetVersionInterface } from "src/server/trpc/route/dataset/datasetVersion";
import { AppCustomAttribute, CreateAppInput } from "src/server/trpc/route/jobs/apps";
import { FrameworkType, TrainJobInput } from "src/server/trpc/route/jobs/jobs";
import { getIdPrivate } from "src/utils/app";
import { inputNumberFloorConfig } from "src/utils/form";
import { formatSize } from "src/utils/format";
import { parseBooleanParam } from "src/utils/parse";
import { trpc } from "src/utils/trpc";
import { styled, useTheme } from "styled-components";

import { validateEnvKeyFormat, validateMountPoints } from "./common";
import { setEntityInitData, useDataOptions, useDataVersionOptions } from "./hooks";

const AfterInputNumber = styled(InputNumber)`
  .ant-select-focused .ant-select-selector{
    color: ${({ theme }) => theme.token.colorText } !important;
  }
`;

interface Props {
  appId?: string;
  appName?: string;
  appStartCommand?: string;
  appImage?: {
    name: string;
    tag: string;
  };
  attributes?: AppCustomAttribute[];
  appComment?: I18nStringType;
  clusterId: string;
  isTraining?: boolean;
  createAppParams?: CreateAppInput;
  trainJobInput?: TrainJobInput;
  useForCreateApp?: boolean;
}

export interface DataAttributes {
  type?: AccessibilityType;
  name?: number;
  version?: number;
  desc?: string;
}

export interface EnvVariable {
  key: string;
  value: string;
}

interface FixedFormFields {
  appJobName: string;
  showAlgorithm: boolean;
  algorithmArray: {
    index: DataAttributes;
  };
  datasetArray: {
    index: DataAttributes;
  };
  modelArray: {
    index: DataAttributes;
  };
  imageSource: ImageSource;
  image: { type?: AccessibilityType, name: number };
  remoteImageUrl: string | undefined;
  framework: FrameworkType | undefined;
  startCommand?: string;
  showDataset: boolean;
  showModel: boolean;
  mountPoints: string[] | undefined;
  partition: string | undefined;
  qos: string;
  coreCount: number;
  nodeCount?: number;
  gpuCount: number | undefined;
  account: string;
  maxTime: number;
  command?: string;
  // TensorFlow特有参数
  psNodes?: number;
  workerNodes?: number;
  envVariables?: EnvVariable[];
  needTensorBoard?: boolean;
  tensorBoardDataPath?: string;
  isDistributedTrain: boolean;
}

interface CustomFormFields {
  customFields: Record<string, number | string | undefined>;
}
type FormFields = CustomFormFields & FixedFormFields;
type TimeUnit = "min" | "hour" | "day";

interface Partition {
  name: string;
  memMb: number;
  cores: number;
  gpus: number;
  nodes: number;
  qos: string[];
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
  nodeCount:2,
  psNodes:1,
  workerNodes:1,
  isDistributedTrain:false,
  coreCount: 1,
  gpuCount: 1,
  maxTime: 60,
} as Partial<FormFields>;
const DISTRIBUTED_TRAIN_INITIAL_NODE_COUNT = 2;

export const LaunchAppForm = (props: Props) => {

  const languageId = useI18n().currentLanguage.id;
  const t = useI18nTranslateToString();
  const p = prefix("app.jobs.launchAppForm.");

  const { clusterId, appName, isTraining = false,useForCreateApp,
    appId, attributes = [], appImage, createAppParams, trainJobInput,appComment,appStartCommand } = props;

  const { message } = App.useApp();
  const theme = useTheme();

  const { publicConfig } = usePublicConfig();
  const router = useRouter();

  const [form] = Form.useForm<FormFields>();

  // 不关心状态值本身，只是用来触发渲染
  const [, forceUpdate] = useState(0);

  const [currentPartitionInfo, setCurrentPartitionInfo] = useState<Partition | undefined>();
  const [maxTimeUnitValue, setMaxTimeUnitValue] = useState<TimeUnit>("min");

  const [frameworkOptions, setFrameworkOptions] = useState<{ value: FrameworkType, label: string }[]>([
    {
      value: "tensorflow",
      label: "TensorFlow",
    },
    {
      value: "pytorch",
      label: "PyTorch",
    },
    {
      value: "mpi",
      label: "Mpi",
    },
  ]);

  const imageSource = Form.useWatch("imageSource", form);
  const isStartCommandEditable = Form.useWatch("isStartCommandEditable", form);
  const needTensorBoard = Form.useWatch("needTensorBoard", form);
  const isDistributedTrain = Form.useWatch("isDistributedTrain", form);

  // 记录添加了多少算法
  const [algorithmGroups, setAlgorithmGroups] = useState<{}[]>([]);
  const [datasetGroups, setDatasetGroups] = useState<{}[]>([]);
  const [modelGroups, setModelGroups] = useState<{}[]>([]);

  // 用户是否修改了算法
  const [isAlgorithmTouched, setIsAlgorithmTouched] = useState(false);
  const [isDatasetTouched, setIsDatasetTouched] = useState(false);
  const [isModelTouched, setIsModelTouched] = useState(false);

  // 添加一组新的 Select 组件
  const handleAddGroup = (groupType: "algorithm" | "dataset" | "model") => {
    // 根据传入的 groupType 更新对应的状态
    switch (groupType) {
      case "algorithm":
        setAlgorithmGroups([...algorithmGroups, {}]);
        setIsAlgorithmTouched(true);
        break;
      case "dataset":
        setDatasetGroups([...datasetGroups, {}]);
        setIsDatasetTouched(true);
        break;
      case "model":
        setModelGroups([...modelGroups, {}]);
        setIsModelTouched(true);
        break;
      default:
        break;
    }

    // 获取 form 中对应的值
    const values = form.getFieldValue(`${groupType}Array`);

    if (values) {
      form.setFieldValue([`${groupType}Array`], values.concat([undefined]));
    } else {
      form.setFieldValue([`${groupType}Array`], [undefined]);
    }
  };

  // 删除一组 Select 组件
  const handleRemoveGroup = (groupType: "algorithm" | "dataset" | "model", index: number) => {
    let newGroups;
    // 根据传入的 groupType 删除对应的组
    switch (groupType) {
      case "algorithm":
        newGroups = algorithmGroups.filter((_, idx) => idx !== index);
        setAlgorithmGroups(newGroups);
        setIsAlgorithmTouched(true);
        break;
      case "dataset":
        newGroups = datasetGroups.filter((_, idx) => idx !== index);
        setDatasetGroups(newGroups);
        setIsDatasetTouched(true);
        break;
      case "model":
        newGroups = modelGroups.filter((_, idx) => idx !== index);
        setModelGroups(newGroups);
        setIsModelTouched(true);
        break;
      default:
        break;
    }

    // 获取 form 中对应的值
    const values = form.getFieldValue(`${groupType}Array`);
    if (values) {
    // 如果删除的是最后一组，则直接将该组的值置为空
      if (index === values.length - 1) {
        form.setFieldValue([`${groupType}Array`, index], undefined);
        return;
      }

      // 删除的是中间的组，移动后面的组的值到前一组
      for (let i = index; i < values.length - 1; i++) {
        const nextGroup = form.getFieldValue([`${groupType}Array`, i + 1]);

        // 将后面的值设置到当前组
        form.setFieldValue([`${groupType}Array`, i], nextGroup);

        if (i === values.length - 2) {
        // 最后一组置空
          form.setFieldValue([`${groupType}Array`, i + 1], undefined);
        }
      }
    }
  };

  // 删除某组算法（handleRemoveGroup）后，只是将algorithmArray的某个index置为undefined，
  // 会让algorithmGroups 和 algorithmValues的长度不一致
  useEffect(() => {
    const algorithmValues = form.getFieldValue("algorithmArray");
    if (algorithmValues && algorithmValues.length > algorithmGroups.length) {
      form.setFieldValue(["algorithmArray"], form.getFieldValue("algorithmArray").slice(0, algorithmGroups.length));
    }
  }, [form,algorithmGroups]);

  useEffect(() => {
    const datasetValues = form.getFieldValue("datasetArray");
    if (datasetValues && datasetValues.length > datasetGroups.length) {
      form.setFieldValue(["datasetArray"], datasetValues.slice(0, datasetGroups.length));
    }
  }, [form, datasetGroups]);

  useEffect(() => {
    const modelValues = form.getFieldValue("modelArray");
    if (modelValues && modelValues.length > modelGroups.length) {
      form.setFieldValue(["modelArray"], modelValues.slice(0, modelGroups.length));
    }
  }, [form, modelGroups]);


  const {
    privateData: privateDatasets, privateDataOptions: privateDatasetOptions,
    publicData: publicDatasets, publicDataOptions:publicDatasetOptions,
    isPrivateDataLoading:  isPrivateDatasetLoading,
    isPublicDataLoading:  isPublicDatasetLoading,
  } = useDataOptions<DatasetInterface>(
    trpc.dataset.list.useQuery,
    clusterId,
    (x) => ({ label:`${x.name}(${x.owner})`, value: x.id }),
  );

  const {
    privateDataVersions: privateDatasetVersions,
    privateDataVersionOptions: privateDatasetVersionOptions,
    isPrivateDataVersionsLoading: isPrivateDatasetVersionsLoading,
    publicDataVersions: publicDatasetVersions,
    publicDataVersionOptions: publicDatasetVersionOptions,
    isPublicDataVersionsLoading:isPublicDatasetVersionsLoading,
  } =
  useDataVersionOptions<DatasetVersionInterface>(
    privateDatasets.map((x) => x.id),
    publicDatasets.map((x) => x.id),
    "dataset",
    trpc.dataset.getMultipleDatasetVersions.useQuery,
    (x) => ({ label: x.versionName, value: x.id, desc:x.versionDescription }),
  );

  const {
    privateData: privateAlgorithms, privateDataOptions: privateAlgorithmOptions,
    publicData: publicAlgorithms, publicDataOptions:publicAlgorithmOptions,
    isPrivateDataLoading:  isPrivateAlgorithmLoading,
    isPublicDataLoading:  isPublicAlgorithmLoading,
  } = useDataOptions<AlgorithmInterface>(
    trpc.algorithm.getAlgorithms.useQuery,
    clusterId,
    (x) => ({ label:`${x.name}(${x.owner})`, value: x.id }),
  );

  const {
    privateDataVersions: privateAlgorithmVersions,
    privateDataVersionOptions: privateAlgorithmVersionOptions,
    isPrivateDataVersionsLoading: isPrivateAlgorithmVersionsLoading,
    publicDataVersions: publicAlgorithmVersions,
    publicDataVersionOptions: publicAlgorithmVersionOptions,
    isPublicDataVersionsLoading:isPublicAlgorithmVersionsLoading,
  } =
  useDataVersionOptions<AlgorithmVersionInterface>(
    privateAlgorithms.map((x) => x.id),
    publicAlgorithms.map((x) => x.id),
    "algorithm",
    trpc.algorithm.getMultipleAlgorithmVersions.useQuery,
    (x) => ({ label: x.versionName, value: x.id, desc:x.versionDescription }),
  );

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
  const selectedImage = Form.useWatch(["image", "name"], form);

  const isImagePublic = imageType !== undefined ? imageType === AccessibilityType.PUBLIC : imageType;

  const { data: images, isLoading: isImagesLoading } = trpc.image.list.useQuery({
    isPublic: isImagePublic !== undefined ? parseBooleanParam(isImagePublic) : undefined,
    clusterId,
    withExternal: "true",
    types:isTraining ? ImageType.TRAIN : ImageType.APP,
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

  const account = Form.useWatch("account", form);

  const nodeCount = Form.useWatch("nodeCount", form);
  const workerNodeCount = Form.useWatch("workerNodes", form);
  const psNodeCount = Form.useWatch("psNodes", form);

  const totalNodeCount = nodeCount ?? ((workerNodeCount ?? 0) + (psNodeCount ?? 0) || 1);

  const coreCount = Form.useWatch("coreCount", form);

  const gpuCount = Form.useWatch("gpuCount", form)!;

  const framework = Form.useWatch("framework", form);

  const imageId = Form.useWatch(["image", "name"], form);

  const { data:partitions, isLoading:getAvailablePartitionIsLoading } = trpc.config.getAvailablePartitions.useQuery(
    { accountName:account,clusterId },
    { enabled:!!account },
  );

  const memorySize = (currentPartitionInfo ?
    currentPartitionInfo.gpus ? totalNodeCount * gpuCount
    * Math.floor(currentPartitionInfo.cores / currentPartitionInfo.gpus)
    * Math.floor(currentPartitionInfo.memMb / currentPartitionInfo.cores) :
      totalNodeCount * coreCount * Math.floor(currentPartitionInfo.memMb / currentPartitionInfo.cores) : 0);
  const memoryDisplay = formatSize(memorySize, ["MB", "GB", "TB"]);

  const coreCountSum = currentPartitionInfo?.gpus
    ? totalNodeCount * gpuCount * Math.floor(currentPartitionInfo.cores / currentPartitionInfo.gpus)
    : totalNodeCount * coreCount;


  const handlePartitionChange = (partition: string) => {
    const partitionInfo = partitions
      ? partitions.find((x) => x.name === partition)
      : undefined;
    if (partitionInfo?.gpus) {
      form.setFieldValue("gpuCount", 1);
    } else {
      form.setFieldValue("coreCount", 1);
    }

    form.setFieldValue("framework", undefined);
    form.setFieldValue("qos", partitionInfo?.qos[0]);

    setCurrentPartitionInfo(partitionInfo);

  };

  const isAscend910 = currentPartitionInfo?.gpuType === "huawei.com/Ascend910";
  const isVgpu = currentPartitionInfo?.gpuType === "volcano.sh/vgpu-number";

  useEffect(() => {
    // 特殊处理，如果是华为Ascend910，则增加MindSpore选项
    if (isAscend910) {
      setFrameworkOptions((prevOptions) => {
        return prevOptions.find((item) => item.value === "mindspore") ?
          prevOptions : [...prevOptions, { value: "mindspore", label: "MindSpore" }];
      });
    } else {
      setFrameworkOptions((prevOptions) => {
        return prevOptions.filter((item) => item.value !== "mindspore");
      });
    }
  }, [isAscend910]);
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
          placeholder={getI18nConfigCurrentText(placeholder, languageId)}
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
        (<InputNumber placeholder={getI18nConfigCurrentText(placeholder, languageId)} />)
        : item.type === "TEXT" ? (<Input placeholder={getI18nConfigCurrentText(placeholder, languageId)} />)
          : (
            <Select
              options={selectOptions.map((x) => ({
                label: getI18nConfigCurrentText(x.label, languageId), value: x.value }))}
              placeholder={getI18nConfigCurrentText(placeholder, languageId)}
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
        label={getI18nConfigCurrentText(item.label, languageId) ?? undefined}
        name={["customFields", item.name]}
        rules={rules}
        initialValue={initialValue}
        {...(item.name === "workingDir" ? {
          tooltip: (
            <>
              <span>{t(p("autoAdd"))}</span>
            </>
          ),
        } : {})}
      >
        {inputItem}
      </Form.Item>
    );
  }), [attributes, currentPartitionInfo,languageId]);

  useEffect(() => {
    const inputParams = trainJobInput || createAppParams;

    // 处理算法相关数据
    const { ids:algorithmIds, isPrivates:isAlgorithmPrivates } =
    inputParams?.algorithms?.length ? getIdPrivate(inputParams.algorithms) : {};

    if (algorithmIds?.length && isAlgorithmPrivates?.length) {
      if (!form.isFieldsTouched(["showAlgorithm"])) {
        setAlgorithmGroups(new Array(algorithmIds.length).fill({}));
      }
    }

    // 处理数据集相关数据
    const { ids:datasetIds, isPrivates:isDatasetPrivates } =
    inputParams?.datasets?.length ? getIdPrivate(inputParams.datasets) : {};

    if (datasetIds?.length && isDatasetPrivates?.length) {
      if (!form.isFieldsTouched(["showDataset"])) {
        setDatasetGroups(new Array(datasetIds.length).fill({}));
      }
    }

    // 处理模型相关数据
    const { ids:modelIds, isPrivates:isModelPrivates } =
    inputParams?.models?.length ? getIdPrivate(inputParams.models) : {};

    if (modelIds?.length && isModelPrivates?.length) {
      if (!form.isFieldsTouched(["showModel"])) {
        setModelGroups(new Array(modelIds.length).fill({}));
      }
    }
  }, [createAppParams, trainJobInput]);

  useEffect(() => {
    // 处理算法相关数据
    const inputParams = trainJobInput || createAppParams;

    const { ids:algorithmIds, isPrivates:isAlgorithmPrivates } =
    inputParams?.algorithms?.length ? getIdPrivate(inputParams.algorithms) : {};

    if (algorithmIds?.length && isAlgorithmPrivates?.length) {
      algorithmIds.forEach((algorithmId,index) => {
        // 如果用户修改表单值，则不再初始化数据
        if (!isAlgorithmTouched && !form.isFieldsTouched(["showAlgorithm",
          ["algorithm",index, "type"], ["algorithm",index, "name"],
          ["algorithm",index, "version"]])) {
          setEntityInitData<AlgorithmVersionInterface, AlgorithmInterface>(
            "algorithmArray",
            index,
            privateAlgorithms,
            privateAlgorithmVersions,
            publicAlgorithms,
            publicAlgorithmVersions,
            algorithmId,
            isAlgorithmPrivates[index],
            form,
            "showAlgorithm",
          );
        }
      });

    }
  }, [createAppParams, trainJobInput, privateAlgorithms,publicAlgorithms,
    privateAlgorithmVersions,publicAlgorithmVersions, form,isAlgorithmTouched]);

  useEffect(() => {
    // 处理数据集相关数据
    const inputParams = trainJobInput || createAppParams;
    const { ids:datasetIds, isPrivates:isDatasetPrivates } =
    inputParams?.datasets?.length ? getIdPrivate(inputParams.datasets) : {};

    if (datasetIds?.length && isDatasetPrivates?.length) {
      datasetIds.forEach((datasetId,index) => {
        // 如果用户修改表单值，则不再初始化数据
        if (!isDatasetTouched && !form.isFieldsTouched(["showDataset",
          ["dataset",index, "type"], ["dataset",index, "name"],
          ["dataset",index, "version"]])) {
          setEntityInitData<DatasetVersionInterface, DatasetInterface>(
            "datasetArray",
            index,
            privateDatasets,
            privateDatasetVersions,
            publicDatasets,
            publicDatasetVersions,
            datasetId,
            isDatasetPrivates[index],
            form,
            "showDataset",
          );
        }
      });

    }
  }, [createAppParams, trainJobInput, privateDatasets,publicDatasets,
    privateDatasetVersions,publicDatasetVersions, form,isDatasetTouched]);

  useEffect(() => {
    // 处理模型相关数据
    const inputParams = trainJobInput || createAppParams;
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
  }, [createAppParams, trainJobInput, privateModels,publicModels,
    privateModelVersions,publicModelVersions, form,isModelTouched]);

  // 处理镜像
  useEffect(() => {
    const inputParams = trainJobInput || createAppParams;
    if (inputParams) {
      if (inputParams.remoteImageUrl || inputParams.image) {
        if (!form.isFieldsTouched([
          "imageSource",
          "startCommand",
          "remoteImageUrl",
          ["image", "type"],
          ["image", "name"],
        ])) {
          form.setFieldValue("imageSource", inputParams.remoteImageUrl ? ImageSource.REMOTE : ImageSource.LOCAL);

          // 处理远程镜像
          if (inputParams.remoteImageUrl) {
            form.setFieldValue("remoteImageUrl", inputParams.remoteImageUrl);
            if ("startCommand" in inputParams) {
              form.setFieldValue("startCommand", inputParams.startCommand);
              form.setFieldValue("isStartCommandEditable", true);
            }
          }
          // 处理本地镜像
          else {
          // 先直接设置镜像类型调接口获取镜像数据
            form.setFieldValue(["image", "type"], inputParams.isImagePrivate ?
              AccessibilityType.PRIVATE : AccessibilityType.PUBLIC);

            // 数据库中有之前存的镜像id才去回显镜像数据,若数据库中已删除了该镜像
            if (images?.items?.find((image) => inputParams.image === image.id)) {
              form.setFieldValue(["image", "name"], inputParams.image);

              if ("startCommand" in inputParams) {
                form.setFieldValue("startCommand", inputParams.startCommand);
              }
            }
          }
        }
      }
      // 默认镜像
      else {
        if (!form.isFieldsTouched(["startCommand"]) && "startCommand" in inputParams) {
          form.setFieldValue("startCommand", inputParams.startCommand);
        }
      }
    }
    // 直接提交作业的情况
    else {
      if (!form.isFieldsTouched(["startCommand"]) && imageSource === ImageSource.DEFAULT) {
        form.setFieldValue("startCommand", appStartCommand);
      }
    }
  }, [createAppParams, trainJobInput, images, form, imageSource, appStartCommand]);

  // 其他参数处理
  useEffect(() => {
    const inputParams = trainJobInput || createAppParams;
    form.setFieldsValue({
      appJobName: genAppJobName(clusterId, appName ?? "t"),
    });

    if (inputParams) {
      const { account, gpuCount, coreCount, maxTime, mountPoints, nodeCount } = inputParams;
      const workingDir = "workingDirectory" in inputParams ? inputParams.workingDirectory : undefined;
      const customAttributes = "customAttributes" in inputParams ? inputParams.customAttributes : {};
      const command = "command" in inputParams ? inputParams.command : undefined;
      const framework = "framework" in inputParams ? inputParams.framework : undefined;
      const psNodes = "psNodes" in inputParams ? inputParams.psNodes : 1;
      const workerNodes = "workerNodes" in inputParams ? inputParams.workerNodes : 1;
      const envVariables = "envVariables" in inputParams ? inputParams.envVariables : undefined;
      const tensorBoardDataPath = "tensorBoardDataPath" in inputParams ? inputParams.tensorBoardDataPath : undefined;

      form.setFieldsValue({
        mountPoints,
        customFields: {
          ...customAttributes,
          workingDir,
        },
        // 单机训练不显示节点数，在前端展示的nodeCount均是 >= 2
        // 单机作业再次提交作业时 nodeCount 是 1,但是前端展示的nodeCount均是 >= 2
        // 故单机作业的再次提交，nodeCount初始值设为 DISTRIBUTED_TRAIN_INITIAL_NODE_COUNT(值为2)
        nodeCount:nodeCount === 1 ? DISTRIBUTED_TRAIN_INITIAL_NODE_COUNT : nodeCount,
        isDistributedTrain: nodeCount > 1 ? true : false,
        framework,
        account,
        // 有可用分区后，再次提交作业可能从cpu分区(不可用)自动切换到gpu分区
        // 但是保存的参数还是cpu数，gpuCount为undefined
        gpuCount:gpuCount ?? 1,
        coreCount:coreCount ?? 1,
        maxTime,
        command,
        psNodes,
        workerNodes,
        envVariables,
        ...tensorBoardDataPath ? {
          needTensorBoard:true,
          tensorBoardDataPath,
        } : {},
      });
    }
  }, [createAppParams, trainJobInput]);

  // 处理分区和分区下的参数QOS
  useEffect(() => {
    const inputParams = trainJobInput || createAppParams;

    if (!inputParams) {
      form.setFieldsValue({
        partition: partitions?.[0]?.name,
        qos:partitions?.[0]?.qos[0],
      });
      setCurrentPartitionInfo(partitions?.[0]);
    }

    if (inputParams) {
    // 且分区、qos没有修改过才设置再次提交的分区参数
      if (!form.isFieldsTouched(["partition","qos"])) {
        const { partition,qos } = inputParams;

        const matchedPartition = partitions?.find((p) => p.name === partition);
        if (inputParams.partition) {
          setCurrentPartitionInfo(matchedPartition ?? partitions?.[0]);
        } else {
          setCurrentPartitionInfo(partitions?.[0]);
        }

        form.setFieldsValue({
          partition:matchedPartition?.name ?? partitions?.[0]?.name,
        });

        const matchedQos = matchedPartition?.qos.find((q) => q === qos);
        if (inputParams.qos) {
          form.setFieldsValue({
            qos:matchedQos ?? partitions?.[0]?.qos[0],
          });
        }
        else {
          form.setFieldsValue({
            qos:partitions?.[0]?.qos[0],
          });
        }
      }
      // 分区、qos和账户有修改过则设置接口获取的数据
      else {
        form.setFieldsValue({
          partition: partitions?.[0]?.name,
          qos:partitions?.[0]?.qos[0],
        });
        setCurrentPartitionInfo(partitions?.[0]);
      }
    }
  }, [createAppParams, trainJobInput, partitions]);

  const createAppSessionMutation = trpc.jobs.createAppSession.useMutation({
    onSuccess() {
      message.success(t(p("createSuccessfully")));
      router.push(`/jobs/${clusterId}/runningJobs`);
    },
    onError(e) {
      message.error(`${t(p("createFailed"))}: ${e.message}`);
    },
  });

  const trainJobMutation = trpc.jobs.trainJob.useMutation({
    onSuccess() {
      message.success(t(p("submitTrainSuccessfully")));
      router.push(`/jobs/${clusterId}/runningJobs`);
    },
    onError(e) {
      message.error(`${t(p("submitTrainFailed"))}: ${e.message}`);
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
        imageSource: !isTraining && appImage ? ImageSource.DEFAULT : ImageSource.LOCAL,
      }}
      labelAlign="left"
      onFinish={async () => {

        const { appJobName, image, remoteImageUrl, framework, startCommand,mountPoints, account, partition, coreCount,
          gpuCount, maxTime, command, customFields, psNodes, workerNodes,qos,envVariables,tensorBoardDataPath } =
          await form.validateFields();

        const algorithmVersions =
        algorithmGroups.map((_,index) => form.getFieldValue(["algorithmArray", index, "version"]))
          .filter((x) => x !== undefined);
        const isAlgorithmPrivates =
        algorithmGroups.map((_,index) =>
          form.getFieldValue(["algorithmArray", index, "type"]) === AccessibilityType.PRIVATE)
          .filter((x) => x !== undefined);

        const datasetVersions =
        datasetGroups.map((_,index) => form.getFieldValue(["datasetArray", index, "version"]))
          .filter((x) => x !== undefined);
        const isDatasetPrivates =
        datasetGroups.map((_,index) =>
          form.getFieldValue(["datasetArray", index, "type"]) === AccessibilityType.PRIVATE)
          .filter((x) => x !== undefined);

        const modelVersions =
        modelGroups.map((_,index) => form.getFieldValue(["modelArray", index, "version"]))
          .filter((x) => x !== undefined);
        const isModelPrivates =
        modelGroups.map((_,index) =>
          form.getFieldValue(["modelArray", index, "type"]) === AccessibilityType.PRIVATE)
          .filter((x) => x !== undefined);

        if (isTraining) {
          await trainJobMutation.mutateAsync({
            clusterId,
            trainJobName: appJobName,
            algorithms:algorithmVersions.map((id,idx) => ({ id,isPrivate:isAlgorithmPrivates[idx] })),
            image: image?.name,
            isImagePrivate:!isImagePublic,
            remoteImageUrl:remoteImageUrl?.trim(),
            framework,
            datasets: datasetVersions.map((id,idx) => ({ id,isPrivate:isDatasetPrivates[idx] })),
            models: modelVersions.map((id,idx) => ({ id,isPrivate:isModelPrivates[idx] })),
            mountPoints,
            account: account,
            partition: partition,
            nodeCount: totalNodeCount,
            coreCount: gpuCount ?
              gpuCount * Math.floor(currentPartitionInfo!.cores / currentPartitionInfo!.gpus) :
              coreCount,
            gpuCount: gpuCount,
            maxTime: transformTime(maxTime),
            memory: memorySize,
            command: command || "",
            gpuType: currentPartitionInfo!.gpuType,
            psNodes,
            workerNodes,
            qos,
            envVariables:envVariables,
            tensorBoardDataPath:tensorBoardDataPath?.trim(),
          });
        } else {
          let workingDirectory: string | undefined;
          const customFormKeyValue: CustomFormFields = { customFields: {} };
          attributes.forEach((customFormAttribute) => {
            const customFormKey = customFormAttribute.name;
            if (customFormKey === "workingDir") {
              workingDirectory = customFields[customFormKey]?.toString();
            }
            if (customFields?.[customFormKey]) {
              customFormKeyValue.customFields[customFormKey] = customFields[customFormKey];
            }
          });

          createAppSessionMutation.mutate({
            clusterId,
            appId: appId!,
            appName: appName!,
            appJobName,
            algorithms:algorithmVersions.map((id,idx) => ({ id,isPrivate:isAlgorithmPrivates[idx] })),
            image: image?.name,
            isImagePrivate:!isImagePublic,
            remoteImageUrl:remoteImageUrl?.trim(),
            startCommand,
            datasets: datasetVersions.map((id,idx) => ({ id,isPrivate:isDatasetPrivates[idx] })),
            models: modelVersions.map((id,idx) => ({ id,isPrivate:isModelPrivates[idx] })),
            mountPoints,
            account: account,
            partition: partition,
            nodeCount: totalNodeCount,
            coreCount: gpuCount ?
              gpuCount * Math.floor(currentPartitionInfo!.cores / currentPartitionInfo!.gpus) :
              coreCount,
            gpuCount: gpuCount,
            maxTime: transformTime(maxTime),
            memory: memorySize,
            workingDirectory,
            customAttributes: customFormKeyValue.customFields,
            gpuType: currentPartitionInfo!.gpuType,
            qos,
            envVariables,
          });
        }
      }
      }
    >
      <Spin spinning={createAppSessionMutation.isLoading || trainJobMutation.isLoading} tip="loading">
        <Form.Item name="appJobName" label={t(p("appJobName"))} rules={[{ required: true }, { max: 42 }]}>
          <Input />
        </Form.Item>
        <Divider orientation="left" orientationMargin="0">
          {isTraining ? t(p("trainConfig")) : t(p("appConfig"))}
        </Divider>
        <Form.Item
          label={t(p("selectImageSource"))}
          name="imageSource"
        >
          <Radio.Group
            onChange={() => {
              form.setFieldsValue({
                image: { type: undefined, name: undefined },
                remoteImageUrl: undefined,
                startCommand: undefined,
                command:undefined,
              });
            }}
            style={{ userSelect:"none" }}
          >
            {!isTraining && appImage && <Radio value={ImageSource.DEFAULT}> {t(p("defaultImage"))} </Radio>}
            <Radio value={ImageSource.LOCAL}> {t(p("localImage"))} </Radio>
            <Radio value={ImageSource.REMOTE}> {t(p("remoteImage"))} </Radio>
          </Radio.Group>
        </Form.Item>
        {imageSource !== ImageSource.REMOTE && (
          <Form.Item
            label={t(p("currentImage"))}
          >
            <Space>
              <span>
                {selectedImage
                  ? imageOptions?.find((x) => x.value === selectedImage)?.label
                  : appImage && imageSource === ImageSource.DEFAULT ? `${appImage?.name}:${appImage?.tag}` : "-"}
              </span>
            </Space>
          </Form.Item>
        )}
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
                      onChange={(value: number) => {
                        const command = images?.items.find((x) => x.id === value)?.startCommand;
                        if (isTraining) {
                          form.setFieldValue("command", command);
                        } else {
                          form.setFieldValue("startCommand", command);
                        }
                      }}
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
              {imageId ? imageDescription[imageId] :
                imageSource === ImageSource.DEFAULT ? getI18nConfigCurrentText(appComment,languageId) :
                  null }
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

        {
          customFormItems
        }

        {!isTraining &&
        (
          <Form.Item label={t(p("command"))} rules={[{ required: true }]} style={{ marginBottom:0 }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <Form.Item
                name="isStartCommandEditable"
                valuePropName="checked"
                style={{ display: "inline-block", marginRight: 8 }}
              >
                <Checkbox>
                  {t(p("editDefaultStartCommand"))}
                </Checkbox>
              </Form.Item>
              <Form.Item
                name="startCommand"
                rules={[{ required: true,message:t(p("requireStartCommand")) }]}
                style={{ flex: 1 }}
              >
                <Input disabled={!isStartCommandEditable} placeholder={t(p("startCommandPlaceholder"))} />
              </Form.Item>
            </div>
          </Form.Item>
        )
        }
        {
          isTraining && (
            <Form.Item label={t(p("command"))} name="command" rules={[{ required: true }]}>
              <Input.TextArea />
            </Form.Item>
          )
        }
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
                        validateMountPoints(t(p("mountsDuplicate")),t(p("mountsText"))),
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
        <Divider orientation="left" orientationMargin="0">{t(p("addOther"))}</Divider>
        <Form.Item label={t(p("addType"))} style={{ marginBottom: 0 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <Form.Item
              name="showAlgorithm"
              valuePropName="checked"
              style={{ display: "inline-block", marginRight: 8 }}
            >
              <Checkbox onChange={(e) => {
                if (e.target.checked) {
                  handleAddGroup("algorithm");
                } else {
                  setAlgorithmGroups([]);
                  form.setFieldValue(["algorithmArray"], undefined);
                }
              }
              }
              >
                {t(p("algorithm"))}
              </Checkbox>
            </Form.Item>
            <Form.Item
              name="showDataset"
              valuePropName="checked"
              style={{ display: "inline-block", marginRight: 8 }}
            >
              <Checkbox onChange={(e) => {
                if (e.target.checked) {
                  handleAddGroup("dataset");
                } else {
                  setDatasetGroups([]);
                  form.setFieldValue(["datasetArray"], undefined);
                }
              }
              }
              >
                {t(p("dataset"))}
              </Checkbox>
            </Form.Item>
            <Form.Item
              name="showModel"
              valuePropName="checked"
              style={{ display: "inline-block", marginRight: 8 }}
            >
              <Checkbox onChange={(e) => {
                if (e.target.checked) {
                  handleAddGroup("model");
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

        {algorithmGroups.map((_, index) => {
          const isPrivate = form.getFieldValue(["algorithmArray", index, "type"]) === AccessibilityType.PRIVATE;

          const algorithmOptions = isPrivate ? privateAlgorithmOptions : publicAlgorithmOptions;
          const algorithmVersionOptionsArray =
          isPrivate ? privateAlgorithmVersionOptions : publicAlgorithmVersionOptions;

          const selectedName = form.getFieldValue(["algorithmArray", index, "name"]);
          const algorithmIndex = algorithmOptions.findIndex((option) => option.value === selectedName);

          const algorithmVersionOptions = algorithmIndex !== -1 && algorithmVersionOptionsArray
            ? algorithmVersionOptionsArray[algorithmIndex] : [];

          const selectedVersion = form.getFieldValue(["algorithmArray", index, "version"]);
          const versionIndex = algorithmVersionOptions.findIndex((option) => option.value === selectedVersion);

          return (
            <>
              <Form.Item
                label={`${t(p("algorithm"))}-${index + 1}`}
                labelCol={{ span: 1, style: { minWidth: "70px" } }}
                wrapperCol={{ span: 23 }}
                key={index}
              >
                <Space>
                  <Form.Item
                    name={["algorithmArray", index, "type"]}
                    noStyle
                    rules={[{ required: true, message: "" }]}
                  >
                    <Select
                      allowClear
                      style={{ minWidth: 120 }}
                      onChange={() => {
                        setIsAlgorithmTouched(true);
                        form.setFieldsValue({
                          algorithmArray: {
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
                            label: t(p("privateAlgorithm")),
                          },
                          {
                            value:  AccessibilityType.PUBLIC,
                            label: t(p("publicAlgorithm")),
                          },
                        ]
                      }
                    />
                  </Form.Item>
                  <Form.Item
                    name={["algorithmArray",index, "name"]}
                    noStyle
                    rules={[{ required: true, message: "" }]}
                  >
                    <Select
                      allowClear
                      style={{ minWidth: 200 }}
                      onChange={() => {
                        setIsAlgorithmTouched(true);
                        form.setFieldValue(["algorithmArray",index, "version"], undefined);
                        forceUpdate((prev) => prev + 1);
                      }}
                      loading={isPrivate ? isPrivateAlgorithmLoading : isPublicAlgorithmLoading}
                      showSearch
                      optionFilterProp="label"
                      options={algorithmOptions}
                    />
                  </Form.Item>
                  <Form.Item
                    name={["algorithmArray",index, "version"]}
                    noStyle
                    rules={[
                      { required: true, message: "" },
                      {
                        validator: () => {
                          const name = form.getFieldValue(["algorithmArray",index, "name"]);
                          const type = form.getFieldValue(["algorithmArray",index, "type"]);
                          const version = form.getFieldValue(["algorithmArray",index, "version"]);

                          // 如果 type 、 version 或 name 其中有一个没有值，返回错误信息
                          if (!type || !version || !name) {
                            return Promise.reject(new Error(t(p("selectAlgorithm"))));
                          }

                          return Promise.resolve();
                        },
                      },
                    ]}
                  >
                    <Select
                      allowClear
                      style={{ minWidth: 100 }}
                      loading={isPrivate ? isPrivateAlgorithmVersionsLoading : isPublicAlgorithmVersionsLoading}
                      showSearch
                      optionFilterProp="label"
                      onChange={() => {
                        setIsAlgorithmTouched(true);
                        forceUpdate((prev) => prev + 1);
                      }}
                      options={algorithmVersionOptions}
                    />
                  </Form.Item>
                  {
                    index === algorithmGroups.length - 1 && (
                      <PlusCircleOutlined
                        onClick={() => handleAddGroup("algorithm")}
                      />
                    )
                  }
                  {algorithmGroups.length > 1 && (
                    <MinusCircleOutlined
                      onClick={() => handleRemoveGroup("algorithm",index)}
                    />
                  )}

                </Space>
              </Form.Item>
              {/* {
                versionIndex !== -1 && algorithmVersionOptions[versionIndex]?.desc &&
              ( */}
              <Form.Item
                label={t(p("algorithmDesc"))}
                name={["algorithmArray",index, "desc"]}
              >
                {versionIndex !== -1 ? algorithmVersionOptions[versionIndex]?.desc : ""}
              </Form.Item>
              {/* )
              } */}
            </>

          );
        })}

        {datasetGroups.map((_, index) => {
          const isPrivate = form.getFieldValue(["datasetArray", index, "type"]) === AccessibilityType.PRIVATE;

          const datasetOptions = isPrivate ? privateDatasetOptions : publicDatasetOptions;
          const datasetVersionOptionsArray =
          isPrivate ? privateDatasetVersionOptions : publicDatasetVersionOptions;

          const selectedName = form.getFieldValue(["datasetArray", index, "name"]);
          const datasetIndex = datasetOptions.findIndex((option) => option.value === selectedName);

          const datasetVersionOptions = datasetIndex !== -1 && datasetVersionOptionsArray
            ? datasetVersionOptionsArray[datasetIndex] : [];

          const selectedVersion = form.getFieldValue(["datasetArray", index, "version"]);
          const versionIndex = datasetVersionOptions.findIndex((option) => option.value === selectedVersion);

          return (
            <>
              <Form.Item
                label={`${t(p("dataset"))}-${index + 1}`}
                labelCol={{ span: 1, style: { minWidth: "70px" } }}
                wrapperCol={{ span: 23 }}
                key={index}
              >
                <Space>
                  <Form.Item
                    name={["datasetArray", index, "type"]}
                    noStyle
                    rules={[{ required: true, message: "" }]}
                  >
                    <Select
                      allowClear
                      style={{ minWidth: 120 }}
                      onChange={() => {
                        setIsDatasetTouched(true);
                        form.setFieldsValue({
                          datasetArray: {
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
                            label: t(p("privateDataset")),
                          },
                          {
                            value:  AccessibilityType.PUBLIC,
                            label: t(p("publicDataset")),
                          },
                        ]
                      }
                    />
                  </Form.Item>
                  <Form.Item
                    name={["datasetArray",index, "name"]}
                    noStyle
                    rules={[{ required: true, message: "" }]}
                  >
                    <Select
                      allowClear
                      style={{ minWidth: 200 }}
                      onChange={() => {
                        setIsDatasetTouched(true);
                        form.setFieldValue(["datasetArray",index, "version"], undefined);
                        forceUpdate((prev) => prev + 1);
                      }}
                      loading={isPrivate ? isPrivateDatasetLoading : isPublicDatasetLoading}
                      showSearch
                      optionFilterProp="label"
                      options={datasetOptions}
                    />
                  </Form.Item>
                  <Form.Item
                    name={["datasetArray",index, "version"]}
                    noStyle
                    rules={[
                      { required: true, message: "" },
                      {
                        validator: () => {
                          const name = form.getFieldValue(["datasetArray",index, "name"]);
                          const type = form.getFieldValue(["datasetArray",index, "type"]);
                          const version = form.getFieldValue(["datasetArray",index, "version"]);

                          // 如果 type 、 version 或 name 其中有一个没有值，返回错误信息
                          if (!type || !version || !name) {
                            return Promise.reject(new Error(t(p("selectDataset"))));
                          }

                          return Promise.resolve();
                        },
                      },
                    ]}
                  >
                    <Select
                      allowClear
                      style={{ minWidth: 100 }}
                      loading={isPrivate ? isPrivateDatasetVersionsLoading : isPublicDatasetVersionsLoading}
                      showSearch
                      optionFilterProp="label"
                      onChange={() => {
                        setIsDatasetTouched(true);
                        forceUpdate((prev) => prev + 1);
                      }}
                      options={datasetVersionOptions}
                    />
                  </Form.Item>
                  {
                    index === datasetGroups.length - 1 && (
                      <PlusCircleOutlined
                        onClick={() => handleAddGroup("dataset")}
                      />
                    )
                  }
                  {datasetGroups.length > 1 && (
                    <MinusCircleOutlined
                      onClick={() => handleRemoveGroup("dataset",index)}
                    />
                  )}

                </Space>
              </Form.Item>
              {/* {
                versionIndex !== -1 && algorithmVersionOptions[versionIndex]?.desc &&
              ( */}
              <Form.Item
                label={t(p("datasetDesc"))}
                name={["datasetArray",index, "desc"]}
              >
                {versionIndex !== -1 ? datasetVersionOptions[versionIndex]?.desc : ""}
              </Form.Item>
              {/* )
              } */}
            </>
          );
        })
        }

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
                        onClick={() => handleAddGroup("model")}
                      />
                    )
                  }
                  {modelGroups.length > 1 && (
                    <MinusCircleOutlined
                      onClick={() => handleRemoveGroup("model",index)}
                    />
                  )}

                </Space>
              </Form.Item>
              {/* {
                versionIndex !== -1 && algorithmVersionOptions[versionIndex]?.desc &&
              ( */}
              <Form.Item
                label={t(p("modelDesc"))}
                name={["modelArray",index, "desc"]}
              >
                {versionIndex !== -1 ? modelVersionOptions[versionIndex]?.desc : ""}
              </Form.Item>
              {/* )
              } */}
            </>
          );
        })
        }

        <Form.List name="envVariables">
          {(fields, { add, remove }) => (
            <>
              {fields.map((field, index) => {
                const { key, ...restField } = field;

                return (
                  <Space key={key} style={{ display: "flex", marginBottom: 8 }} align="baseline">
                    <Form.Item
                      {...restField}
                      label={`${t(p("envVariables"))}-${index + 1}`}
                      name={[field.name, "key"]}
                      rules={[
                        { required: true, message:t(p("envVariablesKeyPlaceholder")) },
                        validateEnvKeyFormat(t(p("envVariablesKeyRule")),t(p("sameEnvVariablesKey"))),
                      ]}
                    >
                      <Input placeholder={t(p("envVariablesKeyPlaceholder"))} />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[field.name, "value"]}
                      rules={[{ required: true, message:t(p("envVariablesValuePlaceholder")) }]}
                    >
                      <Input placeholder={t(p("envVariablesValuePlaceholder"))} />
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
                  {t(p("addEnvVariables"))}
                </Button>
              </Form.Item>
            </>
          )}
        </Form.List>

        <Divider orientation="left" orientationMargin="0">{t(p("resource"))}</Divider>
        <Form.Item
          label={t(p("account"))}
          name="account"
          rules={[{ required: true }]}
        >
          <AccountSelector
            cluster={clusterId}
            useForCreateApp={useForCreateApp}
            appId={useForCreateApp ? appId : undefined}
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
            loading={getAvailablePartitionIsLoading}
            options={partitions
              ? partitions.map((x) => ({ label: x.name, value: x.name }))
              : []
            }
            onChange={handlePartitionChange}
          />
        </Form.Item>
        <Form.Item
          label={t(p("priority"))}
          name="qos"
          rules={[{ required: true }]}
        >
          <Select
            loading={getAvailablePartitionIsLoading}
            disabled={!currentPartitionInfo}
            options={currentPartitionInfo ? currentPartitionInfo.qos.map((x) => ({ label: x, value: x })) : []}
          />
        </Form.Item>
        {/* vgpu只能单机训练 */}
        {
          isTraining && !isVgpu && (
            <Form.Item label={t(p("distributedTrain"))} rules={[{ required: true }]} style={{ marginBottom:0 }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                <Form.Item
                  rules={[{ required: true }]}
                  name="isDistributedTrain"
                  valuePropName="checked"
                  style={{ display: "inline-block", marginRight: 8 }}
                >
                  <Switch />
                </Form.Item>
                {
                  isDistributedTrain && (
                    <Form.Item
                      name="framework"
                      rules={[{ required: true,message:t(p("needFramework")) }]}
                    >
                      <Select options={frameworkOptions} style={{ minWidth: 150 }}>
                      </Select>
                    </Form.Item>
                  )
                }
              </div>
            </Form.Item>
          )
        }
        {
          isDistributedTrain && framework !== "tensorflow" && (
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
                min={2}
                {...inputNumberFloorConfig}
              />
            </Form.Item>
          )
        }
        {(isDistributedTrain && framework === "tensorflow") && (
          <>
            <Form.Item
              label={t(p("psNodes"))}
              name="psNodes"
              rules={[
                { required: true,
                  type: "integer",
                },
              ]}
            >
              <InputNumber
                min={0}
                {...inputNumberFloorConfig}
              />
            </Form.Item>
          </>
        )}
        {(isDistributedTrain && framework === "tensorflow") && (
          <>
            <Form.Item
              label={t(p("workerNodes"))}
              name="workerNodes"
              rules={[
                { required: true,
                  type: "integer",
                },
              ]}
            >
              <InputNumber
                min={1}
                {...inputNumberFloorConfig}
              />
            </Form.Item>
          </>
        )}
        {
          currentPartitionInfo?.gpus ? (
            <Form.Item
              label={t(p("gpuCount"))}
              name="gpuCount"
              dependencies={["partition","nodeCount","psNodes","workerNodes"]}
              rules={[
                {
                  required: true,
                  type: "integer",
                  validator:  (_, value) => {
                    if (currentPartitionInfo
                          && currentPartitionInfo.gpus > 0
                          && (totalNodeCount * value > currentPartitionInfo.gpus)) {
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
              dependencies={["partition","nodeCount","psNodes","workerNodes"]}
              rules={[
                { required: true,
                  type: "integer",
                  validator: (_, value) => {
                    if (currentPartitionInfo && (totalNodeCount * value > currentPartitionInfo.cores)) {
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
        <Form.Item
          label={t(p("maxTime"))}
          name="maxTime"
          rules={[{
            validator: (_, value) => {
              if (!value) {
                return Promise.reject(new Error(t(p("requireMaxTime"))));
              }

              if (publicConfig.MAX_JOB_RUNNING_TIME_HOURS !== undefined
                        && (transformTime(value) > publicConfig.MAX_JOB_RUNNING_TIME_HOURS * 60)) {
                return Promise.reject(new Error(t(p("maxTimeTips"),
                  [publicConfig.MAX_JOB_RUNNING_TIME_HOURS.toString()])));
              }
              return Promise.resolve();
            },
          }]}
        >
          <AfterInputNumber
            min={1}
            step={1}
            precision={0}
            theme={theme}
            addonAfter={
              (
                <Select
                  style={{ minWidth:"70px" }}
                  value={maxTimeUnitValue}
                  onChange={(value) => {
                    setMaxTimeUnitValue(value);
                    // 手动更新 maxTime 的值，并触发验证
                    form.validateFields(["maxTime"]);
                  }}
                >
                  <Select.Option value="min">{t(p("min"))}</Select.Option>
                  <Select.Option value="hour">{t(p("hour"))}</Select.Option>
                  <Select.Option value="day">{t(p("day"))}</Select.Option>
                </Select>
              )
            }
          />
        </Form.Item>
        <Row>
          {
            currentPartitionInfo?.gpus
              ?
              (
                <Col span={12} sm={6}>
                  <Form.Item label={t(p("totalGpus"))}>
                    {totalNodeCount * gpuCount}
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
          isTraining ? (
            <>
              <Divider orientation="left" orientationMargin="0">{t(p("trainResults"))}</Divider>
              <Form.Item
                label="TensorBoard"
                name="needTensorBoard"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
              { needTensorBoard ?
                (
                  <Form.Item
                    label={t(p("tensorBoardDataPath"))}
                    name="tensorBoardDataPath"
                    rules={[{ required: true }]}
                  >
                    <Input
                      placeholder={t(p("tensorBoardDataPlaceholder"))}
                      prefix={
                        (
                          <FileSelectModal
                            allowedFileType={["DIR"]}
                            onSubmit={(path: string) => {
                              form.setFieldsValue({
                                tensorBoardDataPath: path,
                              });
                            }}
                            clusterId={clusterId ?? ""}
                          />
                        )
                      }
                    />
                  </Form.Item>
                )
                : null}
            </>
          ) : null
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
          loading={createAppSessionMutation.isLoading}
        >
          {t("button.submitButton")}
        </Button>
      </Form.Item>
    </Form>
  );
};
