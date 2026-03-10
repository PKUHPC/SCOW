import { I18nStringType } from "@scow/config/build/i18n";
import { TrimInput as Input } from "@scow/lib-web/build/components/styledAntdCom/TrimInput";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Button, Col, Divider, Form, InputNumber, Row, Select, Spin, Typography } from "antd";
import { Rule } from "antd/es/form";
import { NamePath } from "antd/es/form/interface";
import { FormInstance } from "antd/lib";
import dayjs from "dayjs";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAsync } from "react-async";
import { useStore } from "simstate";
import { api } from "src/apis";
import { ClusterNotAvailablePage } from "src/components/errorPages/ClusterNotAvailablePage";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { AccountStatusFilter, ReservedAppAttributeName } from "src/models/job";
import { AccountListSelector } from "src/pageComponents/job/AccountListSelector";
import { AppCustomAttribute, CommandSelectReservedConfig, FixedValueConfig, ReservedAppAttribute,
  SelectConfig, SelectConfigOption, SelectOption,
} from "src/pages/api/app/getAppMetadata";
import { Partition } from "src/pages/api/cluster";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { UserStore } from "src/stores/UserStore";
import { formatMinutesToI18nDayHours, formatSize, TransType } from "src/utils/format";
import { styled, useTheme } from "styled-components";

import { AdvancedFileSelectModal } from "../filemanager/AdvancedFileSelectModal";
import { PartitionSelector } from "../job/PartitionSelector";
import { CommandSelect } from "./CommandSelect";


const Text = styled(Typography.Paragraph)`
`;

const AfterInputNumber = styled(InputNumber)`
  .ant-select-focused .ant-select-selector{
    color: ${({ theme }) => theme.token.colorText } !important;
  }
`;

interface Props {
  appId: string;
  clusterId: string;
  appName: string;
  attributes: AppCustomAttribute[];
  appComment?: I18nStringType;
  reservedAppAttributes?: ReservedAppAttribute[];
}

interface FormFields {
  appJobName: string;
  partition: string | undefined;
  qos: string | undefined;
  nodeCount: number;
  coreCount: number;
  gpuCount: number | undefined;
  account: string;
  maxTime: number;
}
type TimeUnit = "min" | "hour" | "day";

// 生成默认应用名称，命名规则为"集群Id-当前应用名-年月日-时分秒"
const genAppJobName = (clusterId: string,appName: string): string => {
  return `${clusterId}-${appName}-${dayjs().format("YYYYMMDD-HHmmss")}`;
};

const inputNumberFloorConfig = {
  formatter: (value: number) => `${Math.floor(value)}`,
  parser: (value: string) => Math.floor(+value),
};

const p = prefix("pageComp.app.launchAppForm.");
const pCommon = prefix("common.");

export const LaunchAppForm: React.FC<Props> = ({
  clusterId, appId, attributes, appName, appComment, reservedAppAttributes }) => {

  const { currentClusters, fullClusterConfigs } = useStore(ClusterInfoStore);
  const currentCluster = currentClusters.find((c) => (c.id === clusterId));
  if (!currentCluster) {
    return <ClusterNotAvailablePage />;
  }

  const { message, modal } = App.useApp();
  const theme = useTheme();
  const { user } = useStore(UserStore);

  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;

  const appCommentI18nText = appComment ? getI18nConfigCurrentText(appComment, languageId) : undefined;

  const [form] = Form.useForm<FormFields>();
  const [loading, setLoading] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const router = useRouter();

  const createErrorModal = (message: string) => modal.error({
    title: t(p("errorMessage")),
    okText: t("button.confirmButton"),
    content: formatErrorMsg(message),
  });


  function formatErrorMsg(logText: string) {
    const detailsRegex = /Details\s*:\s*([\s\S]*)$/i;
    const match = detailsRegex.exec(logText);

    if (match?.[1]) {
      return match[1].trim();
    }
    return logText;
  }

  const onSubmit = async () => {
    const allFormFields = await form.validateFields();
    const { appJobName, nodeCount, coreCount, gpuCount, partition, qos, account, maxTime } = allFormFields;

    const customFormKeyValue: Record<string, string> = {};
    attributes.forEach((customFormAttribute) => {
      const customFormKey = customFormAttribute.name;
      customFormKeyValue[customFormKey] = allFormFields[customFormKey];
    });

    setLoading(true);
    setIsSubmitting(true);
    await api.createAppSession({ body: {
      cluster: clusterId,
      appId,
      appName,
      appJobName: appJobName,
      nodeCount: nodeCount,
      coreCount: gpuCount ? gpuCount * Math.floor(currentPartitionInfo!.cores / currentPartitionInfo!.gpus) : coreCount,
      gpuCount,
      memory,
      partition,
      qos,
      account,
      maxTime: transformTime(maxTime),
      customAttributes: customFormKeyValue,
    } })
      .httpError(500, (e) => {
        if (e.code === "SBATCH_FAILED") {
          createErrorModal(e.message);
        } else {
          throw e;
        }
      })
      .httpError(403, (e) => {
        if (e.code === "USER_ACCOUNT_NOT_AVAILABLE") {
          createErrorModal(t("pages.common.userAccountNotAvailableWhenSubmit", [user?.identityId, account]));
        } else if (e.code === "CLUSTER_PARTITION_NOT_AVAILABLE") {
          const clusterName = getI18nConfigCurrentText(currentClusters.find((cluster) => cluster.id == clusterId)?.name
            ?? clusterId, languageId);
          createErrorModal(t("pages.common.clusterPartitionNotAvailableForAccount", [account, clusterName, partition]));
        } else if (e.code === "APP_NOT_AVAILABLE") {
          createErrorModal(t("pages.common.appNotAvailableForAccount", [account, appId]));
        } else {
          throw e;
        }
      })
      .httpError(404, (e) => {
        if (e.code === "APP_NOT_FOUND") {
          createErrorModal(t("pages.common.appNotFound", [appId]));
        } else {
          throw e;
        }
      })
      .httpError(400, (e) => {
        if (e.code === "INVALID_INPUT") {
          createErrorModal(e.message);
        } else {
          message.error(t(pCommon("invalidParameter")));
        }
      })
      .httpError(429, () => { message.error(t(pCommon("noSpaceError"))); })
      .then(() => {
        message.success(t(p("successMessage")));
        const searchParams = new URLSearchParams(window.location.search);
        const callbackPath = searchParams.get("callbackPath");

        if (callbackPath) {
          window.location.href = callbackPath;
        } else {
          router.push(`/apps/${clusterId}/sessions`);
        }
      }).finally(() => {
        setLoading(false);
      });
  };

  const [currentPartitionInfo, setCurrentPartitionInfo] = useState<Partition | undefined>();
  const [accountsReloadTrigger, setAccountsReloadTrigger] = useState<boolean>(false);
  const [partitionsReloadTrigger, setPartitionsReloadTrigger] = useState<boolean>(false);
  const [accountPartitionsCacheMap, setAccountPartitionsCacheMap] = useState<Record<string, Partition[]>>({});
  const [selectableAccounts, setSelectableAccounts] = useState<string[]>([]);
  const [maxTimeUnitValue, setMaxTimeUnitValue] = useState<TimeUnit>("min");

  const account = Form.useWatch("account", form);

  const nodeCount = Form.useWatch("nodeCount", form);

  const coreCount = Form.useWatch("coreCount", form);

  const gpuCount = Form.useWatch("gpuCount", form)!;

  // 判断系统保留APP字段:账户及分区或qos 是否已配置为固定值字段
  const fixedAccountName =
    getInitialFixedValueByAttributeName(reservedAppAttributes, ReservedAppAttributeName.ACCOUNT);
  const fixedPartitionName =
    getInitialFixedValueByAttributeName(reservedAppAttributes, ReservedAppAttributeName.PARTITION);
  const fixedQosName =
    getInitialFixedValueByAttributeName(reservedAppAttributes, ReservedAppAttributeName.QOS);

  const fixedNodeCountValue =
    getInitialFixedValueByAttributeName(reservedAppAttributes, ReservedAppAttributeName.NODE_COUNT);
  const fixedCoreCountValue =
    getInitialFixedValueByAttributeName(reservedAppAttributes, ReservedAppAttributeName.CORE_COUNT);
  const fixedGpuCountValue =
    getInitialFixedValueByAttributeName(reservedAppAttributes, ReservedAppAttributeName.GPU_COUNT);
  const fixedMaxTimeValue =
    getInitialFixedValueByAttributeName(reservedAppAttributes, ReservedAppAttributeName.MAX_TIME);

  const initialValues = {
    nodeCount: fixedNodeCountValue ? parseInt(fixedNodeCountValue, 10) : 1,
    coreCount: fixedCoreCountValue ? parseInt(fixedCoreCountValue, 10) : 1,
    gpuCount: fixedGpuCountValue ? parseInt(fixedGpuCountValue, 10) : 1,
    maxTime: fixedMaxTimeValue ? parseInt(fixedMaxTimeValue, 10) : 60,
  } as Partial<FormFields>;

  // 判断系统保留APP字段是否配置为了固定值选项
  const fixedAccountList
     = getFixedValueListByAttributeName(reservedAppAttributes, ReservedAppAttributeName.ACCOUNT)
       .map((x) => x.toString());
  const fixedPartitionList
     = getFixedValueListByAttributeName(reservedAppAttributes, ReservedAppAttributeName.PARTITION)
       .map((x) => x.toString());
  const fixedQosList
  = getFixedValueListByAttributeName(reservedAppAttributes, ReservedAppAttributeName.QOS)
    .map((x) => x.toString());
  const fixedCoreCountList
     = getFixedValueListByAttributeName(reservedAppAttributes, ReservedAppAttributeName.CORE_COUNT)
       .map((x) => typeof x === "number" ? x : parseInt(x, 10));
  const fixedNodeCountList
    = getFixedValueListByAttributeName(reservedAppAttributes, ReservedAppAttributeName.NODE_COUNT)
      .map((x) => typeof x === "number" ? x : parseInt(x, 10));
  const fixedGpuCountList
    = getFixedValueListByAttributeName(reservedAppAttributes, ReservedAppAttributeName.GPU_COUNT)
      .map((x) => typeof x === "number" ? x : parseInt(x, 10));
  const fixedMaxTimeList
    = getFixedValueListByAttributeName(reservedAppAttributes, ReservedAppAttributeName.MAX_TIME)
      .map((x) => typeof x === "number" ? x : parseInt(x, 10));

  useAsync({ promiseFn: useCallback(async () => {

    // 获取上一次提交记录
    await api.getAppLastSubmission({ query: { cluster: clusterId, appId } })
      .then(async (lastData) => {

        form.setFieldValue("appJobName", genAppJobName(clusterId, appName));

        // 进入页面时第一次请求集群下未封锁账户
        await api.getAccounts({ query: {
          cluster: clusterId,
          statusFilter: AccountStatusFilter.UNBLOCKED_ONLY,
          useForCreateApp: true,
          appId,
        } })
          .httpError(404, (error) => { message.error(error.message); })
          .then(async (accountsResp) => {

            // 保存配置表单以外必填项的对象
            let requiredInputObj = {};

            // 判断初始值是否配置了固定的账户名或固定选项的账户名
            if (accountsResp?.accounts.length || fixedAccountList.length > 0 || fixedAccountName) {

              // 按照是否已配置账户数据set可选账户列表
              if (fixedAccountList.length > 0) {
                setSelectableAccounts(fixedAccountList);
              } else if (fixedAccountName) {
                setSelectableAccounts([fixedAccountName]);
              } else {
                setSelectableAccounts(accountsResp.accounts);
              }

              const lastSub = lastData?.lastSubmissionInfo;
              const lastAccount = lastSub?.account;
              const lastPartition = lastSub?.partition;
              const lastQos = lastSub?.qos;
              const lastCoreCount = lastSub?.coreCount;
              const lastNodeCount = lastSub?.nodeCount;
              const lastGpuCount = lastSub?.gpuCount;
              const lastMaxTime = lastSub?.maxTime;
              const lastAttributes = lastSub?.customAttributes;

              // 比较上一次提交记录判断初始应该set的账户值
              // 如果上一次提交信息中的账户存在且在当前可选账户列表中，则填入上一次提交记录中的账户
              // 如果上一次提交信息不存在，或者提交信息中的账户存在但不在当前可选列表中，则填入账户列表的第一个值
              // 如果上一次提交信息不存在，且已配置了账户固定值，则填入账户初始固定值
              const firstInputAccount = (() => {
                if (fixedAccountList.length > 0) {
                  if (lastData && lastAccount && fixedAccountList?.includes(lastAccount)) {
                    return lastAccount;
                  } else {
                    return fixedAccountList?.[0].toString();
                  }
                }

                if (fixedAccountName) {
                  if (lastData && lastAccount && fixedAccountName && lastAccount === fixedAccountName) {
                    return lastAccount;
                  } else {
                    return fixedAccountName;
                  }
                }

                if (lastData && lastAccount && accountsResp.accounts.includes(lastSub?.account)) {
                  return lastAccount;
                }

                return accountsResp.accounts[0];
              })();

              // 获取第一次填入账户可用分区
              // 如果已配置账户固定值，直接获取账户固定值的可用分区
              // 判断初始值是否配置了固定的账户名或固定选项的账户名
              await api.getAvailablePartitionsForCluster({ query: {
                cluster: clusterId,
                accountName: firstInputAccount,
              } })
                .then((partitionsResp) => {

                  if (Array.isArray(partitionsResp?.partitions)) {

                    const resPartitions = partitionsResp.partitions;

                    const setLastPartition = !!lastPartition && (
                      // 如果已配置固定值或固定选项，上一次填写的值为固定值或在固定选项中
                      (fixedPartitionName && fixedPartitionName === lastPartition)
                      || (fixedPartitionList?.some((x) => (x === lastPartition)))
                      // 没有配置固定值，上一次填写的值在可选分区列表中
                      || (!fixedPartitionName && resPartitions.some((item) => item.name === lastPartition))
                    );

                    // 第一次set的分区信息获取
                    // 如果上一次的值符合set要求，而且存在于当前可选分区中，获取该分区信息作为详细信息
                    // 如果不在当前可选分区中，没有配置固定值或固定选项时则使用当前分区列表第一项
                    // 配置了固定值或固定选项时，则使用固定分区的初始值在可选分区中的信息（没有则为undefined）
                    let firstPartitionInfo: Partition | undefined = undefined;
                    firstPartitionInfo = setLastPartition ?
                      resPartitions.find((item) => item.name === lastPartition)
                      : (!fixedPartitionName ?
                        resPartitions[0] : resPartitions.find((item) => item.name === fixedPartitionName));

                    setCurrentPartitionInfo(firstPartitionInfo);
                    setAccountPartitionsCacheMap({ [firstInputAccount]: resPartitions });


                    const setLastQos = setLastPartition && (
                      (fixedQosName && fixedQosName === lastQos)
                      || (fixedQosList?.some((x) => (x === lastQos)))
                      || (firstPartitionInfo?.qos?.some((item) => item === lastQos))
                    );
                    const setLastCoreCount = setLastPartition && lastCoreCount && (
                      (fixedCoreCountValue && parseInt(fixedCoreCountValue, 10) === lastCoreCount)
                      || (fixedCoreCountList?.some((x) => (x === lastCoreCount)))
                      || (firstPartitionInfo?.cores && firstPartitionInfo.cores >= lastCoreCount)
                    );
                    const setLastNodeCount = setLastPartition && lastNodeCount && (
                      (fixedNodeCountValue && parseInt(fixedNodeCountValue, 10) === lastNodeCount)
                      || (fixedNodeCountList?.some((x) => (x === lastNodeCount)))
                      || (firstPartitionInfo?.nodes && firstPartitionInfo.nodes >= lastNodeCount)
                    );
                    const setLastGpuCount = setLastPartition && lastGpuCount && (
                      (fixedGpuCountValue && parseInt(fixedGpuCountValue, 10) === lastGpuCount)
                      || (fixedGpuCountList?.some((x) => (x === lastGpuCount)))
                      || (firstPartitionInfo?.gpus && firstPartitionInfo.gpus >= lastGpuCount)
                    );

                    const setLastMaxTimeWhenFixed = lastMaxTime && (
                      (fixedMaxTimeValue && parseInt(fixedMaxTimeValue, 10) === lastMaxTime)
                      || (fixedMaxTimeList?.some((x) => x === lastMaxTime))
                    );

                    requiredInputObj = {
                      account: firstInputAccount,
                      partition: setLastPartition ? lastPartition
                        : (fixedPartitionName ? fixedPartitionName : firstPartitionInfo?.name),
                      qos: setLastQos ? lastQos
                        : (fixedQosName ? fixedQosName : firstPartitionInfo?.qos?.[0]),
                      nodeCount: setLastNodeCount ? lastNodeCount : initialValues.nodeCount,
                      coreCount: setLastCoreCount ? lastCoreCount : initialValues.coreCount,
                      gpuCount: setLastGpuCount ? lastGpuCount : initialValues.gpuCount,
                      // 最大运行时间判断
                      // 如果上一次提交记录存在，且已配置固定值，需要满足上一次提交记录等于固定值或在固定选项中
                      maxTime: fixedMaxTimeValue ? (setLastMaxTimeWhenFixed ? lastMaxTime : fixedMaxTimeValue)
                        : (lastMaxTime ?? initialValues.maxTime),
                    };

                    // 如果存在上一次提交信息且上一次提交信息中的配置HTML表单与当前配置HTML表单内容相同，则填入上一次提交信息中的值
                    const attributesInputObj = {};
                    if (lastAttributes) {
                      attributes.forEach((attribute) => {
                        if (attribute.name in lastAttributes) {
                          switch (attribute.type) {
                            case "NUMBER":
                              attributesInputObj[attribute.name] = parseInt(lastAttributes[attribute.name]);
                              break;
                            case "TEXT":
                            case "FILE":
                            case "COMMAND_SELECT":
                              // COMMAND_SELECT 的选项是动态获取的，无法在此处通过静态列表校验（attribute.select 为空）
                              // 且 CommandSelect 组件内部已实现了"若当前值不在选项中，则自动选择第一个"的逻辑
                              // 所以这里直接回填历史值即可
                              attributesInputObj[attribute.name] = lastAttributes[attribute.name];
                              break;
                            case "SELECT":
                              // 区分是否有GPU，防止没有GPU的分区获取到GPU版本的选项
                              if (!firstPartitionInfo?.gpus) {
                                // 筛选选项：若没有配置requireGpu直接使用，配置了requireGpu项使用与否则看改分区有无GPU
                                const selectOptions = attribute.select.filter((x) =>
                                  !x.requireGpu || (x.requireGpu && firstPartitionInfo?.gpus));

                                if (selectOptions.some((optionItem) =>
                                  optionItem.value === lastAttributes[attribute.name]))
                                {
                                  attributesInputObj[attribute.name] = lastAttributes[attribute.name];
                                }
                              }
                              else {
                                if (attribute.select.some((optionItem) =>
                                  optionItem.value === lastAttributes[attribute.name]))
                                {
                                  attributesInputObj[attribute.name] = lastAttributes[attribute.name];
                                }
                              }

                              break;
                            default:
                              break;
                          }
                        }
                      });
                    }

                    form.setFieldsValue({ ...requiredInputObj, ...attributesInputObj });
                  }

                });

            }

          });

      }).finally(() => setLoading(false));
  }, []) });

  const handleAccountsReload = () => {
    setAccountsReloadTrigger((prev) => prev = !prev);
    // 账户重新获取时，清除所有保存的账户分区信息
    setAccountPartitionsCacheMap({});
  };

  const handlePartitionsReload = () => {
    setPartitionsReloadTrigger((prev) => prev = !prev);
    // 分区重新获取时，刷新已选择账户的分区信息
    const newPartitionsMap = { ...accountPartitionsCacheMap };
    if (accountPartitionsCacheMap[account]) {
      delete newPartitionsMap[account];
    }
    setAccountPartitionsCacheMap(newPartitionsMap);
  };

  const prevAccountsReloadTriggerRef = useRef<boolean>(false);
  // 获取未封锁账户.
  const unblockedAccountsQuery = useAsync({
    promiseFn: useCallback(async () => {
      // 确保进入页面后在查询上一次提交记录后，如果不点击账户刷新按钮不触发额外请求
      if (!loading && prevAccountsReloadTriggerRef.current !== accountsReloadTrigger) {
        return await api.getAccounts({ query: {
          cluster: clusterId,
          statusFilter: AccountStatusFilter.UNBLOCKED_ONLY,
        } })
          .httpError(404, (error) => { message.error(error.message); })
          .then((data) => {

            setSelectableAccounts(data.accounts);
            prevAccountsReloadTriggerRef.current = accountsReloadTrigger;
          });
      }
    }, [accountsReloadTrigger, loading]),
  });


  // 当已选择账户为可选账户且前端未缓存账户可用分区数据时，获取账户的可见分区
  const availablePartitionsForAccountQuery = useAsync({
    promiseFn: useCallback(async () => {
      if (account && selectableAccounts.includes(account) && !accountPartitionsCacheMap[account] && !loading) {
        const newPartitionsMap = { ...accountPartitionsCacheMap };
        return await api.getAvailablePartitionsForCluster({ query: {
          cluster: clusterId,
          accountName: account,
        } })
          .then((data) => {
            newPartitionsMap[account] = data.partitions;
            setAccountPartitionsCacheMap(newPartitionsMap);
            if (data.partitions.length > 0) {

              // 如果已配置分区固定值，set 分区固定值对应的分区详细信息，如果不存在则为undefined
              // 判断初始值是否配置了固定的分区名或固定选项的分区名
              if (fixedPartitionName) {
                const fixedPartitionInfo = data.partitions.find((p) => (p.name === fixedPartitionName));
                setCurrentPartitionInfo(fixedPartitionInfo);
                resetPartitionInfo(fixedPartitionInfo);
              } else {
                setCurrentPartitionInfo(data.partitions[0]);
                resetPartitionInfo(data.partitions[0]);
              }
            } else {
              setCurrentPartitionInfo(undefined);
              resetPartitionInfo(undefined);
            }
          });
      };
      return { partitions: [] as Partition[] };
    }, [account, partitionsReloadTrigger, selectableAccounts, loading]),
  });

  // 当需要重置分区信息时，分区信息重置
  const resetPartitionInfo = (partitionInfo: Partition | undefined) => {
    form.setFieldsValue({
      partition: partitionInfo?.name,
      qos: partitionInfo?.qos?.[0],
    });
    if (partitionInfo?.gpus) {
      form.setFieldValue("gpuCount", initialValues.gpuCount);
      form.validateFields(["gpuCount"]);
    } else {
      form.setFieldValue("coreCount", initialValues.coreCount);
      form.validateFields(["coreCount"]);
    }
  };

  const handlePartitionChange = (partition: string) => {
    const account = form.getFieldValue("account");
    const partitionInfo = accountPartitionsCacheMap[account]
      ? accountPartitionsCacheMap[account].find((x) => x.name === partition)
      : undefined;
    // 如果已选分区下没有QOS数据，判断是否配置了固定qos值
    form.setFieldValue("qos", partitionInfo?.qos?.[0] ?? fixedQosName);
    if (partitionInfo?.gpus) {
      form.setFieldValue("gpuCount", initialValues.gpuCount);
      form.validateFields(["gpuCount"]);
    } else {
      form.setFieldValue("coreCount", initialValues.coreCount);
      form.validateFields(["coreCount"]);
    }
    setCurrentPartitionInfo(partitionInfo);
  };

  // 账户手动变更时，如果账户可用分区已经存在于前端缓存，则重置分区和qos
  const handleAccountChange = (account: string) => {
    const cacheMap = accountPartitionsCacheMap[account];
    if (cacheMap) {
      // 如果已配置分区固定值，set 分区固定值对应的分区详细信息，如果不存在则为undefined
      // 判断初始值是否配置了固定的分区名或固定选项的分区名
      if (fixedPartitionName) {
        const fixedPartitionInfo = cacheMap.find((x) => (x.name === fixedPartitionName));
        setCurrentPartitionInfo(fixedPartitionInfo);
        resetPartitionInfo(fixedPartitionInfo);
      } else {
        setCurrentPartitionInfo(cacheMap[0]);
        resetPartitionInfo(cacheMap[0]);
      }
    } else {
      setCurrentPartitionInfo(undefined);
      resetPartitionInfo(undefined);
    }
  };

  const customFormItems = useMemo(() => attributes.map((item, index) => {
    const rules: Rule[] = item.type === "NUMBER"
      ? [{ type: "integer" }, { required: item.required }]
      : [{ required: item.required }];

    const placeholder = item.placeholder ?? "";

    // 筛选选项：若没有配置requireGpu直接使用，配置了requireGpu项使用与否则看改分区有无GPU
    const selectOptions = item.select.filter((x) => !x.requireGpu || (x.requireGpu && currentPartitionInfo?.gpus));

    // 当为 SELECT 类型时
    // 如果配置了默认值，但是默认值不存在于select下选项的value中；或者如果没有配置默认值
    // 则默认显示SELECT的第一项
    const initialValue = item.type === "SELECT" ?
      getSelectAttributeInitalValue(item.defaultValue, selectOptions) : item.defaultValue;

    const getAttributeElement = (item: any): JSX.Element => {

      // 如果配置了不可修改的固定值
      if (item.type !== "SELECT" && item.fixedValue?.value) {

        const currentValue = form.getFieldValue(item.name);
        const newFormValue = item.type === "NUMBER" ? parseInt(item.fixedValue.value) : item.fixedValue.value;
        // 保证固定值被写入
        if (currentValue !== newFormValue) {
          form.setFieldsValue({ [item.name]: newFormValue });
          form.validateFields([item.name]);
        }

        return (<div> {newFormValue} </div>);
      }

      if (item.type === "NUMBER") {
        return (<InputNumber placeholder={getI18nConfigCurrentText(placeholder, languageId)} />);
      } else if (item.type === "TEXT") {
        return (<Input placeholder={getI18nConfigCurrentText(placeholder, languageId)} />);
      } else if (item.type === "SELECT") {
        return (
          <Select
            options={selectOptions.map((x) => ({
              label: getI18nConfigCurrentText(x.label, languageId), value: x.value }))}
            placeholder={getI18nConfigCurrentText(placeholder, languageId)}
          />
        );
      } else if (item.type === "COMMAND_SELECT") {
        return (
          <CommandSelect
            label={getI18nConfigCurrentText(item.label, languageId)}
            appId={appId}
            clusterId={clusterId}
            attributeName={item.name}
            placeholder={getI18nConfigCurrentText(placeholder, languageId)}
          />
        );
      } else {
        // 如果 item.type === FILE
        return (
          <Input
            placeholder={item.placeholder}
            prefix={
              (
                <div style={{ marginRight: "4px" }}>
                  <AdvancedFileSelectModal
                    allowedFileType={["DIR", "FILE"]}
                    onSubmit={(path: string) => {
                      form.setFields([{ name: item.name, value: path, touched: true }]);
                      form.validateFields([item.name]);
                    }}
                    clusterId={clusterId}
                    scowdEnabled={fullClusterConfigs[clusterId]?.scowd?.enabled}
                  />
                </div>

              )
            }
          />
        );
      }

    };

    const inputItem = getAttributeElement(item);

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
        label={getI18nConfigCurrentText(item.label, languageId)}
        name={item.name}
        rules={rules}
        initialValue={initialValue}
        hidden={item.fixedValue?.hidden}
      >
        {inputItem}
      </Form.Item>
    );
  }), [attributes, currentPartitionInfo, languageId]);

  const memorySize = (currentPartitionInfo ?
    currentPartitionInfo.gpus ? nodeCount * gpuCount
    * Math.floor(currentPartitionInfo.cores / currentPartitionInfo.gpus)
    * Math.floor(currentPartitionInfo.memMb / currentPartitionInfo.cores) :
      nodeCount * coreCount * Math.floor(currentPartitionInfo.memMb / currentPartitionInfo.cores) : 0);
  const memory = memorySize + "MB";
  const memoryDisplay = formatSize(memorySize, ["MB", "GB", "TB"]);

  const coreCountSum = currentPartitionInfo?.gpus
    ? nodeCount * gpuCount * Math.floor(currentPartitionInfo.cores / currentPartitionInfo.gpus)
    : nodeCount * coreCount;

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
    <>
      <Form
        form={form}
        onFinish={onSubmit}
        initialValues={{
          ... initialValues,
        }}
      >
        <Spin spinning={loading} tip={isSubmitting ? "" : t(p("loading"))}>
          <FixedOrEditableFormItem
            form={form}
            languageId={languageId}
            t={t}
            name="appJobName"
            label={t(p("appJobName"))}
            rules={[{ required: true }, { max: 50 }]}
            reservedConfig={getReservedAppAttributeConfig(reservedAppAttributes, ReservedAppAttributeName.APP_JOB_NAME)}
            children={(
              <Input />
            )}
            currentPartitionIsWithGpu={!!currentPartitionInfo?.gpus}
            appId={appId}
            clusterId={clusterId}
          />
          <FixedOrEditableFormItem
            form={form}
            languageId={languageId}
            t={t}
            name="account"
            label={t(p("account"))}
            rules={[
              { required: true },
            ]}
            reservedConfig={getReservedAppAttributeConfig(reservedAppAttributes, ReservedAppAttributeName.ACCOUNT)}
            children={(
              <AccountListSelector
                selectableAccounts={ selectableAccounts ?? []}
                isLoading={unblockedAccountsQuery.isLoading}
                onReload={handleAccountsReload}
                onChange={handleAccountChange}
              />
            )}
            currentPartitionIsWithGpu={!!currentPartitionInfo?.gpus}
            onChange={handleAccountChange}
            appId={appId}
            clusterId={clusterId}
          />

          <FixedOrEditableFormItem
            form={form}
            languageId={languageId}
            t={t}
            name="partition"
            label={t(p("partition"))}
            rules={[
              { required: true },
            ]}
            reservedConfig={getReservedAppAttributeConfig(reservedAppAttributes, ReservedAppAttributeName.PARTITION)}
            children={(
              <PartitionSelector
                isLoading={availablePartitionsForAccountQuery.isLoading || unblockedAccountsQuery.isLoading}
                selectablePartitions={accountPartitionsCacheMap[account] ?
                  accountPartitionsCacheMap[account].map((x) => x.name) : []}
                onReload={handlePartitionsReload}
                onChange={handlePartitionChange}
              />
            )}
            currentPartitionIsWithGpu={!!currentPartitionInfo?.gpus}
            onChange={handlePartitionChange}
            appId={appId}
            clusterId={clusterId}
          />
          <FixedOrEditableFormItem
            form={form}
            languageId={languageId}
            t={t}
            name="qos"
            label={t(p("qos"))}
            rules={[
              { required: true },
            ]}
            reservedConfig={getReservedAppAttributeConfig(reservedAppAttributes, ReservedAppAttributeName.QOS)}
            children={(
              <Select
                loading={availablePartitionsForAccountQuery.isLoading || unblockedAccountsQuery.isLoading}
                options={currentPartitionInfo?.qos?.map((x) => ({ label: x, value: x }))}
                placeholder={(!currentPartitionInfo?.qos) || currentPartitionInfo.qos.length === 0 ?
                  t(p("noSelectableQos")) : ""}
              />
            )}
            currentPartitionIsWithGpu={!!currentPartitionInfo?.gpus}
            appId={appId}
            clusterId={clusterId}
          />
          <FixedOrEditableFormItem
            form={form}
            languageId={languageId}
            t={t}
            name="nodeCount"
            label={t(p("nodeCount"))}
            dependencies={["partition"]}
            rules={[
              { required: true, type: "integer", max: currentPartitionInfo?.nodes },
            ]}
            reservedConfig={getReservedAppAttributeConfig(reservedAppAttributes, ReservedAppAttributeName.NODE_COUNT)}
            children={(
              <InputNumber
                min={1}
                max={currentPartitionInfo?.nodes}
                {...inputNumberFloorConfig}
              />
            )}
            isNumberAttribute={true}
            currentPartitionIsWithGpu={!!currentPartitionInfo?.gpus}
            appId={appId}
            clusterId={clusterId}
          />
          {
            currentPartitionInfo?.gpus ? (
              <FixedOrEditableFormItem
                form={form}
                languageId={languageId}
                t={t}
                name="gpuCount"
                label={t(p("gpuCount"))}
                dependencies={["partition"]}
                rules={[
                  {
                    required: true,
                    type: "integer",
                    max: currentPartitionInfo?.gpus / currentPartitionInfo.nodes,
                  },
                ]}
                reservedConfig={
                  getReservedAppAttributeConfig(reservedAppAttributes, ReservedAppAttributeName.GPU_COUNT)}
                children={(
                  <InputNumber
                    min={1}
                    max={currentPartitionInfo?.gpus / currentPartitionInfo.nodes}
                    {...inputNumberFloorConfig}
                  />
                )}
                isNumberAttribute={true}
                currentPartitionIsWithGpu={!!currentPartitionInfo?.gpus}
                appId={appId}
                clusterId={clusterId}
              />
            ) : (
              <FixedOrEditableFormItem
                form={form}
                languageId={languageId}
                t={t}
                name="coreCount"
                label={t(p("coreCount"))}
                dependencies={["partition"]}
                rules={[
                  { required: true,
                    type: "integer",
                    max: currentPartitionInfo ?
                      currentPartitionInfo.cores / currentPartitionInfo.nodes : undefined,
                  },
                ]}
                reservedConfig={
                  getReservedAppAttributeConfig(reservedAppAttributes, ReservedAppAttributeName.CORE_COUNT)}
                children={(
                  <InputNumber
                    min={1}
                    max={currentPartitionInfo ?
                      currentPartitionInfo.cores / currentPartitionInfo.nodes : undefined }
                    {...inputNumberFloorConfig}
                  />
                )}
                isNumberAttribute={true}
                currentPartitionIsWithGpu={!!currentPartitionInfo?.gpus}
                appId={appId}
                clusterId={clusterId}
              />
            )
          }
          <FixedOrEditableFormItem
            form={form}
            languageId={languageId}
            t={t}
            name="maxTime"
            label={t(p("maxTime"))}
            rules={[{ required: true }]}
            reservedConfig={getReservedAppAttributeConfig(reservedAppAttributes, ReservedAppAttributeName.MAX_TIME)}
            children={(
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
                      <Select.Option value="min">{t(p("minute"))}</Select.Option>
                      <Select.Option value="hour">{t(p("hour"))}</Select.Option>
                      <Select.Option value="day">{t(p("day"))}</Select.Option>
                    </Select>
                  )
                }
              />
            )}
            isNumberAttribute={true}
            currentPartitionIsWithGpu={!!currentPartitionInfo?.gpus}
            appId={appId}
            clusterId={clusterId}
          />

          {customFormItems}
          <Row>
            {
              currentPartitionInfo?.gpus
                ?
                (
                  <Col span={12} sm={6}>
                    <Form.Item label={t(p("totalGpuCount"))}>
                      {nodeCount * gpuCount}
                    </Form.Item>
                  </Col>
                ) : null
            }
            <Col span={12} sm={6}>
              <Form.Item label={t(p("totalCpuCount"))}>
                {coreCountSum}
              </Form.Item>
            </Col>
            <Col span={12} sm={6}>
              <Form.Item label={t(p("totalMemory"))}>
                {memoryDisplay}
              </Form.Item>
            </Col>
          </Row>
        </Spin>

        <Form.Item>
          <Button
            onClick={() => {
              const searchParams = new URLSearchParams(window.location.search);
              const callbackPath = searchParams.get("callbackPath");

              if (callbackPath) {
                window.location.href = callbackPath;
              } else {
                router.push(`/apps/${clusterId}/createApps`);
              }
            }}
            style={{ marginRight: "10px" }}
          >
            {t("button.cancelButton")}
          </Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            {t("button.submitButton")}
          </Button>
        </Form.Item>
      </Form>
      {
        appCommentI18nText && (
          <div style={{ marginTop: "64px" }}>
            <Divider />
            <PageTitle titleText={t(p("appCommentTitle"))} />
            <Text>
              <div
                dangerouslySetInnerHTML={{ __html: appCommentI18nText }}
              />
            </Text>
          </div>
        )
      }
    </>

  );
};

// 在已配置固定值或固定选项时，获取系统保留字段的对应formField的固定值初始值
const getInitialFixedValueByAttributeName = (
  reservedAppAttributes: ReservedAppAttribute[] | undefined,
  attributeName: ReservedAppAttributeName,
): string | undefined => {

  const attribute = reservedAppAttributes?.find((x) => x.name === attributeName);

  if (!attribute) {
    return undefined;
  }

  // 根据配置类型返回初始值
  if (attribute.reservedConfig.type === "fixedValue") {
    return attribute.reservedConfig.fixedValue.value.toString();
  } else if (attribute.reservedConfig.type === "select") {
    const value = getSelectAttributeInitalValue(
      attribute.reservedConfig.defaultValue,
      attribute.reservedConfig.select,
    );
    return value?.toString();
  }

  return undefined;
};

// 在已配置固定值或固定选项时，获取系统保留字段的对应formField的固定值初始值
const getFixedValueListByAttributeName = (
  reservedAppAttributes: ReservedAppAttribute[] | undefined,
  attributeName: ReservedAppAttributeName,
): (string | number)[] => {

  const attribute = reservedAppAttributes?.find((x) => x.name === attributeName);

  if (!attribute) {
    return [];
  }

  // 根据配置类型返回初始值
  if (attribute.reservedConfig.type === "select") {
    return attribute.reservedConfig.select.map((x) => (x.value));
  }

  return [];
};

// 判断选项类型的默认初始值是默认值还是选项的默认第一项
const getSelectAttributeInitalValue = (
  defaultValue: string | number | undefined,
  selectOptions: SelectOption[] | SelectConfigOption[],
): string | number | undefined => {

  if (defaultValue && selectOptions?.some((option) => option.value === defaultValue)) {
    return defaultValue;
  } else {
    return selectOptions?.[0].value ?? undefined;
  }
};

const getReservedAppAttributeConfig = (
  attributes: ReservedAppAttribute[] | undefined,
  attributeName: ReservedAppAttributeName,
): FixedValueConfig | SelectConfig | CommandSelectReservedConfig | undefined => {
  return attributes?.find((x) => (x.name === attributeName))?.reservedConfig;
};

function ensureNumberValue(value: string | number): number {
  if (typeof value === "number") {
    return value;
  } else {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? 0 : parsed;
  }
}

interface FixedOrEditableFormItemProps {
  form: FormInstance<FormFields>;
  languageId: string;
  t: TransType;
  name: string;
  label: string;
  rules?: object[];
  dependencies?: NamePath[];
  reservedConfig?: FixedValueConfig | SelectConfig | CommandSelectReservedConfig;
  children: React.ReactNode;
  isNumberAttribute?: boolean;
  ignoreDependenciesWhenFixed?: boolean;
  currentPartitionIsWithGpu?: boolean;
  onChange?: ((value: string) => void) | undefined;
  appId?: string;
  clusterId?: string;
}

/**
 * 渲染系统保留字段使用的组件
 * 1.如果没有配置，则按原始逻辑可编辑样式
 * 1.如果配置为fixedValue形式，显示固定值判断是否隐藏
 * 2.如果配置为select选项形式，显示下拉框
 */
const FixedOrEditableFormItem: React.FC<FixedOrEditableFormItemProps> = ({
  form, languageId, t, name, label, rules, dependencies, reservedConfig, children,
  isNumberAttribute, ignoreDependenciesWhenFixed, currentPartitionIsWithGpu,
  onChange, appId, clusterId,
}) => {

  // 当系统保留字段被配置为固定值时，直接渲染固定值
  if (reservedConfig?.type === "fixedValue" && reservedConfig?.fixedValue?.value !== undefined) {

    const value =
      isNumberAttribute ? ensureNumberValue(reservedConfig.fixedValue.value) : reservedConfig.fixedValue.value;

    useEffect(() => {
      const currentValue = form.getFieldValue(name);
      // 保证固定值被写入
      if (currentValue !== value) {
        form.setFieldsValue({ [name]: value });
      }
      form.validateFields([name]);
    });

    return (
      <Form.Item
        name={name}
        label={label}
        rules={rules}
        hidden={reservedConfig.fixedValue.hidden}
        dependencies={ignoreDependenciesWhenFixed ? undefined : dependencies}
      >
        <div>
          { name === "maxTime" ?
            formatMinutesToI18nDayHours(typeof value === "string" ?
              parseInt(value, 10) : value, t) : reservedConfig.fixedValue.value
          }
        </div>
      </Form.Item>
    );
  // 当系统保留字段被配置为下拉框选项时
  } else if (reservedConfig?.type === "select") {

    // 筛选选项：若没有配置requireGpu直接使用，配置了requireGpu项使用与否则看改分区有无GPU
    const selectOptions =
      reservedConfig?.select.filter((x) => !x.requireGpu || (x.requireGpu && currentPartitionIsWithGpu));

    // 使用单个useEffect处理所有逻辑
    useEffect(() => {

      const selectInitialValue = getSelectAttributeInitalValue(reservedConfig.defaultValue, reservedConfig.select);
      const initialFormValue = selectInitialValue ?
        (isNumberAttribute ? ensureNumberValue(selectInitialValue) : selectInitialValue) : undefined;

      // 判断是否配置了requireGpu选项
      const hasRequireGpuOption = reservedConfig?.select.some((i) => i.requireGpu !== undefined);
      // 获取当前值并确保类型一致
      const currentValue = form.getFieldValue(name);

      // 检查当前值是否在可选项中
      const isValueInOptions = currentValue && selectOptions.some((option) => {
        const optionValue = isNumberAttribute ? ensureNumberValue(option.value) : option.value;
        return optionValue === currentValue;
      });

      // 需要设置新值的情况：
      // 1. 当前值不存在
      // 2. 当前值不在可选项列表中
      // 3. 有requireGpu配置且当前值不在筛选后的选项中
      const needsNewValue = !currentValue || !isValueInOptions ||
        (currentPartitionIsWithGpu && hasRequireGpuOption && !selectOptions.some((o) => {
          const optionValue = isNumberAttribute ? ensureNumberValue(o.value) : o.value;
          return optionValue === currentValue;
        }));

      if (needsNewValue) {
        form.setFieldsValue({ [name]: initialFormValue });
      }

      // 无论如何都进行验证
      form.validateFields([name]);

    });

    const getAttributeElement = (): JSX.Element => {
      return (
        <Select
          options={selectOptions.map((x) => {

            if (name === "maxTime" && !x.label) {
              return {
                label: formatMinutesToI18nDayHours(ensureNumberValue(x.value), t),
                value: ensureNumberValue(x.value),
              };
            }
            return {
              label: `${x.label ? getI18nConfigCurrentText(x.label, languageId) : x.value}`,
              value: isNumberAttribute ? ensureNumberValue(x.value) : x.value,
            };

          })}
          onChange={onChange}
        />
      );
    };

    return (
      <Form.Item
        name={name}
        label={label}
        rules={rules}
        dependencies={ignoreDependenciesWhenFixed ? undefined : dependencies}
      >
        {getAttributeElement()}
      </Form.Item>
    );

  } else if (reservedConfig?.type === "commandSelect") {
    return (
      <Form.Item
        name={name}
        label={label}
        rules={rules}
        dependencies={ignoreDependenciesWhenFixed ? undefined : dependencies}
      >
        <CommandSelect
          label={label}
          appId={appId!}
          clusterId={clusterId!}
          attributeName={name}
          onChange={onChange}
        />
      </Form.Item>
    );
  }

  // 没有特殊保留配置时，渲染 Form.Item 和动态子组件
  return (
    <Form.Item
      name={name}
      label={label}
      rules={rules}
      dependencies={dependencies}
    >
      {children}
    </Form.Item>
  );
};
