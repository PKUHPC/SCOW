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

import { I18nStringType } from "@scow/config/build/i18n";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Button, Col, Divider, Form, Input, InputNumber, Row, Select, Spin, Typography } from "antd";
import { Rule } from "antd/es/form";
import dayjs from "dayjs";
import Router from "next/router";
import { useCallback, useMemo, useRef, useState } from "react";
import { useAsync } from "react-async";
import { api } from "src/apis";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { AccountStatusFilter } from "src/models/job";
import { AccountListSelector } from "src/pageComponents/job/AccountListSelector";
import { AppCustomAttribute } from "src/pages/api/app/getAppMetadata";
import { Partition } from "src/pages/api/cluster";
import { formatSize } from "src/utils/format";
import { styled } from "styled-components";

import { PartitionSelector } from "../job/PartitionSelector";

const Text = styled(Typography.Paragraph)`
`;

interface Props {
  appId: string;
  clusterId: string;
  appName: string;
  attributes: AppCustomAttribute[];
  appComment?: I18nStringType;
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
  formatter: (value: number) => `${Math.floor(value)}`,
  parser: (value: string) => Math.floor(+value),
};

const p = prefix("pageComp.app.launchAppForm.");

export const LaunchAppForm: React.FC<Props> = ({ clusterId, appId, attributes, appName, appComment }) => {

  const { message, modal } = App.useApp();

  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;

  const appCommentI18nText = appComment ? getI18nConfigCurrentText(appComment, languageId) : undefined;

  const [form] = Form.useForm<FormFields>();
  const [loading, setLoading] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const createErrorModal = (message: string) => modal.error({
    title: t(p("errorMessage")),
    content: message,
  });

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
      appJobName: appJobName,
      nodeCount: nodeCount,
      coreCount: gpuCount ? gpuCount * Math.floor(currentPartitionInfo!.cores / currentPartitionInfo!.gpus) : coreCount,
      gpuCount,
      memory,
      partition,
      qos,
      account,
      maxTime,
      customAttributes: customFormKeyValue,
    } })
      .httpError(500, (e) => {
        if (e.code === "SBATCH_FAILED") {
          createErrorModal(e.message);
        } else {
          throw e;
        }
      })
      .httpError(404, (e) => {
        if (e.code === "APP_NOT_FOUND") {
          createErrorModal(e.message);
        } else {
          throw e;
        }
      })
      .httpError(400, (e) => {
        if (e.code === "INVALID_INPUT") {
          createErrorModal(e.message);
        } else {
          throw e;
        }
      })
      .httpError(409, (e) => {
        if (e.code === "ALREADY_EXISTS") {
          createErrorModal(e.message);
        } else {
          throw e;
        }
      })
      .then(() => {
        message.success(t(p("successMessage")));
        Router.push(`/apps/${clusterId}/sessions`);
      }).finally(() => {
        setLoading(false);
      });
  };

  const [currentPartitionInfo, setCurrentPartitionInfo] = useState<Partition | undefined>();
  const [accountsReloadTrigger, setAccountsReloadTrigger] = useState<boolean>(false);
  const [partitionsReloadTrigger, setPartitionsReloadTrigger] = useState<boolean>(false);
  const [accountPartitionsCacheMap, setAccountPartitionsCacheMap] = useState<Record<string, Partition[]>>({});
  const [selectableAccounts, setSelectableAccounts] = useState<string[]>([]);

  const account = Form.useWatch("account", form);

  const nodeCount = Form.useWatch("nodeCount", form);

  const coreCount = Form.useWatch("coreCount", form);

  const gpuCount = Form.useWatch("gpuCount", form)!;

  useAsync({ promiseFn: useCallback(async () => {

    // 获取上一次提交记录
    await api.getAppLastSubmission({ query: { cluster: clusterId, appId } })
      .then(async (lastData) => {

        form.setFieldValue("appJobName", genAppJobName(appName));

        // 进入页面时第一次请求集群下未封锁账户
        await api.getAccounts({ query: {
          cluster: clusterId,
          statusFilter: AccountStatusFilter.UNBLOCKED_ONLY,
        } })
          .httpError(404, (error) => { message.error(error.message); })
          .then(async (accountsResp) => {

            // 保存配置表单以外必填项的对象
            let requiredInputObj = {};

            if (accountsResp?.accounts.length) {
              setSelectableAccounts(accountsResp.accounts);
              const lastSub = lastData?.lastSubmissionInfo;
              const lastAccount = lastSub?.account;
              const lastPartition = lastSub?.partition;
              const lastQos = lastSub?.qos;
              const lastCoreCount = lastSub?.coreCount;
              const lastNodeCount = lastSub?.nodeCount;
              const lastGpuCount = lastSub?.gpuCount;
              const lastMaxTime = lastSub?.maxTime;
              const lastAttributes = lastSub?.customAttributes;

              // 如果上一次提交信息中的账户存在且在当前可选账户列表中，则填入上一次提交记录中的账户
              // 如果上一次提交信息不存在，或者提交信息中的账户存在但不在当前可选列表中，则填入账户列表的第一个值
              const firstInputAccount = (lastData && lastAccount &&
              accountsResp.accounts.includes(lastSub?.account)) ?
                lastAccount : accountsResp.accounts[0];

              // 获取第一次填入账户可用分区
              await api.getAvailablePartitionsForCluster({ query: {
                cluster: clusterId,
                accountName: firstInputAccount,
              } }).then((partitionsResp) => {

                if (partitionsResp?.partitions.length) {
                  // 如果上一次提交信息中的分区存在于当前账户可见分区列表,则填入上一次提交记录的分区,否则填入当前列表分区的第一项
                  const resPartitions = partitionsResp.partitions;
                  const setLastPartition = !!lastPartition &&
                    resPartitions.some((item) => item.name === lastPartition);

                  const firstPartitionInfo: Partition = setLastPartition ?
                    resPartitions.find((item) => item.name === lastPartition)!
                    : resPartitions[0];

                  setCurrentPartitionInfo(firstPartitionInfo);
                  setAccountPartitionsCacheMap({ [firstInputAccount]: resPartitions });

                  const setLastQos = setLastPartition &&
                      firstPartitionInfo.qos?.some((item) => item === lastQos);
                  const setLastCoreCount = setLastPartition && lastCoreCount &&
                      firstPartitionInfo.cores && firstPartitionInfo.cores >= lastCoreCount;
                  const setLastNodeCount = setLastPartition && lastNodeCount &&
                      firstPartitionInfo.nodes && firstPartitionInfo.nodes >= lastNodeCount;
                  const setLastGpuCount = setLastPartition && lastGpuCount &&
                      firstPartitionInfo.gpus && firstPartitionInfo.gpus >= lastGpuCount;

                  requiredInputObj = {
                    account: firstInputAccount,
                    partition: setLastPartition ? lastPartition : firstPartitionInfo.name,
                    qos: setLastQos ? lastQos : firstPartitionInfo?.qos?.[0],
                    nodeCount: setLastNodeCount ? lastNodeCount : initialValues.nodeCount,
                    coreCount: setLastCoreCount ? lastCoreCount : initialValues.coreCount,
                    gpuCount: setLastGpuCount ? lastGpuCount : initialValues.gpuCount,
                    maxTime: lastMaxTime ?? initialValues.maxTime,
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
                            attributesInputObj[attribute.name] = lastAttributes[attribute.name];
                            break;
                          case "SELECT":
                          // 区分是否有GPU，防止没有GPU的分区获取到GPU版本的选项
                            if (!firstPartitionInfo.gpus) {
                            // 筛选选项：若没有配置requireGpu直接使用，配置了requireGpu项使用与否则看改分区有无GPU
                              const selectOptions = attribute.select.filter((x) =>
                                !x.requireGpu || (x.requireGpu && firstPartitionInfo.gpus));

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
  // 获取未封锁账户
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
            setCurrentPartitionInfo(data.partitions[0]);
            restPartitionInfo(data.partitions[0]);
          });
      };
      return { partitions: [] as Partition[] };
    }, [account, partitionsReloadTrigger, selectableAccounts, loading]),
  });

  // 当需要重置分区信息时，分区信息重置
  const restPartitionInfo = (partitionInfo: Partition) => {
    form.setFieldsValue({
      partition: partitionInfo.name,
      qos: partitionInfo.qos?.[0],
    });
    if (partitionInfo?.gpus) {
      form.setFieldValue("gpuCount", 1);
    } else {
      form.setFieldValue("coreCount", 1);
    }
  };

  const handlePartitionChange = (partition: string) => {
    const account = form.getFieldValue("account");
    const partitionInfo = accountPartitionsCacheMap[account]
      ? accountPartitionsCacheMap[account].find((x) => x.name === partition)
      : undefined;
    form.setFieldValue("qos", partitionInfo?.qos?.[0]);
    if (partitionInfo?.gpus) {
      form.setFieldValue("gpuCount", 1);
    } else {
      form.setFieldValue("coreCount", 1);
    }
    setCurrentPartitionInfo(partitionInfo);
  };


  // 账户手动变更时，如果账户可用分区已经存在于前端缓存，则重置分区和qos
  const handleAccountChange = (account: string) => {
    const cacheMap = accountPartitionsCacheMap[account];
    if (cacheMap) {
      setCurrentPartitionInfo(cacheMap[0]);
      restPartitionInfo(cacheMap[0]);
    }
  };


  const customFormItems = useMemo(() => attributes.map((item, index) => {
    const rules: Rule[] = item.type === "NUMBER"
      ? [{ type: "integer" }, { required: item.required }]
      : [{ required: item.required }];

    const placeholder = item.placeholder ?? "";

    // 筛选选项：若没有配置requireGpu直接使用，配置了requireGpu项使用与否则看改分区有无GPU
    const selectOptions = item.select.filter((x) => !x.requireGpu || (x.requireGpu && currentPartitionInfo?.gpus));
    const initialValue = item.type === "SELECT" ? (item.defaultValue ?? selectOptions[0].value) : item.defaultValue;
    const inputItem = item.type === "NUMBER" ?
      (<InputNumber placeholder={getI18nConfigCurrentText(placeholder, languageId)} />)
      : item.type === "TEXT" ? (<Input placeholder={getI18nConfigCurrentText(placeholder, languageId)} />)
        : (
          <Select
            options={selectOptions.map((x) => ({
              label: getI18nConfigCurrentText(x.label, languageId), value: x.value }))}
            placeholder={getI18nConfigCurrentText(placeholder, languageId)}
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
        label={getI18nConfigCurrentText(item.label, languageId) ?? undefined}
        name={item.name}
        rules={rules}
        initialValue={initialValue}
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
          <Form.Item name="appJobName" label={t(p("appJobName"))} rules={[{ required: true }, { max: 50 }]}>
            <Input />
          </Form.Item>
          <Form.Item
            label={t(p("account"))}
            name="account"
            rules={[{ required: true }]}
          >
            <AccountListSelector
              selectableAccounts={ selectableAccounts ?? []}
              isLoading={unblockedAccountsQuery.isLoading}
              onReload={handleAccountsReload}
              onChange={handleAccountChange}
            />
          </Form.Item>

          <Form.Item
            label={t(p("partition"))}
            name="partition"
            rules={[{ required: true }]}
          >
            <PartitionSelector
              isLoading={availablePartitionsForAccountQuery.isLoading || unblockedAccountsQuery.isLoading}
              selectablePartitions={accountPartitionsCacheMap[account] ?
                accountPartitionsCacheMap[account].map((x) => x.name) : []}
              onReload={handlePartitionsReload}
              onChange={handlePartitionChange}
            />
          </Form.Item>

          <Form.Item
            label={t(p("qos"))}
            name="qos"
            rules={[{ required: true }]}
          >
            <Select
              loading={(!currentPartitionInfo?.qos) || currentPartitionInfo.qos.length === 0}
              options={currentPartitionInfo?.qos?.map((x) => ({ label: x, value: x }))}
            />
          </Form.Item>
          <Form.Item
            label={t(p("nodeCount"))}
            name="nodeCount"
            dependencies={["partition"]}
            rules={[
              { required: true, type: "integer", max: currentPartitionInfo?.nodes },
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
                label={t(p("gpuCount"))}
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
                label={t(p("coreCount"))}
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
          <Form.Item label={t(p("maxTime"))} name="maxTime" rules={[{ required: true }]}>
            <InputNumber min={1} step={1} addonAfter={t(p("minute"))} />
          </Form.Item>

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
            onClick={() => Router.push(`/apps/${clusterId}/createApps`)}
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
