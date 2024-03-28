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

import { parsePlaceholder } from "@scow/lib-config/build/parse";
import { App, Button, Checkbox, Col, Form, Input, InputNumber, Row, Select } from "antd";
import dayjs from "dayjs";
import Router from "next/router";
import { join } from "path";
import React, { useCallback, useEffect, useState } from "react";
import { useAsync } from "react-async";
import { useStore } from "simstate";
import { api } from "src/apis";
import { SingleClusterSelector } from "src/components/ClusterSelector";
import { CodeEditor } from "src/components/CodeEditor";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { AccountStatusFilter } from "src/models/job";
import { FileSelectModal } from "src/pageComponents/job/FileSelectModal";
import { Partition } from "src/pages/api/cluster";
import { DefaultClusterStore } from "src/stores/DefaultClusterStore";
import { Cluster } from "src/utils/config";
import { formatSize } from "src/utils/format";

import { AccountListSelector } from "./AccountListSelector";
import { PartitionSelector } from "./PartitionSelector";

interface JobForm {
  cluster: Cluster;
  partition: string;
  nodeCount: number;
  coreCount: number;
  gpuCount: number | undefined;
  command: string;
  jobName: string;
  qos: string | undefined;
  maxTime: number;
  account: string;
  comment: string;
  workingDirectory: string;
  output: string;
  errorOutput: string;
  save: boolean;
}

// 生成默认工作名称，命名规则为年月日-时分秒，如job-20230510-103010
const genJobName = (): string => {
  return `job-${dayjs().format("YYYYMMDD-HHmmss")}`;
};

// 设置节点数，单节点核心数，单节点GPU卡数填入变化config
const inputNumberFloorConfig = {
  formatter: (value) => `${Math.floor(value)}`,
  parser: (value) => Math.floor(+value),
};

const initialValues = {
  command: "",
  nodeCount: 1,
  coreCount: 1,
  gpuCount: 1,
  maxTime: 30,
  output: "job.%j.out",
  errorOutput: "job.%j.err",
  save: false,
} as Partial<JobForm>;

interface Props {
  initial?: typeof initialValues;
  submitJobPromptText: string;
}

const p = prefix("pageComp.job.submitJobForm.");

export const SubmitJobForm: React.FC<Props> = ({ initial = initialValues, submitJobPromptText }) => {

  const { message, modal } = App.useApp();

  const [form] = Form.useForm<JobForm>();
  const [loading, setLoading] = useState(false);

  const t = useI18nTranslateToString();

  const submit = async () => {
    const { cluster, command, jobName, coreCount, gpuCount, workingDirectory, output, errorOutput, save,
      maxTime, nodeCount, partition, qos, account, comment } = await form.validateFields();

    setLoading(true);

    await api.submitJob({ body: {
      cluster: cluster.id, command, jobName, account,
      coreCount: gpuCount ? gpuCount * Math.floor(currentPartitionInfo!.cores / currentPartitionInfo!.gpus) : coreCount,
      gpuCount,
      maxTime, nodeCount, partition, qos, comment,
      workingDirectory, save, memory, output, errorOutput,
    } })
      .httpError(500, (e) => {
        if (e.code === "SCHEDULER_FAILED") {
          modal.error({
            title: t(p("errorMessage")),
            content: e.message,
          });
        } else {
          throw e;
        }
      })
      .httpError(404, (e) => {
        if (e.code === "NOT_FOUND") {
          modal.error({
            title: t(p("errorMessage")),
            content: e.message,
          });
        } else {
          throw e;
        }
      })
      .then(({ jobId }) => {
        message.success(t(p("successMessage")) + jobId);
        Router.push("/jobs/runningJobs");
      })
      .finally(() => setLoading(false));
  };

  const cluster = Form.useWatch("cluster", form) as Cluster | undefined;

  const jobName = Form.useWatch("jobName", form) as string;

  const nodeCount = Form.useWatch("nodeCount", form) as number;

  const coreCount = Form.useWatch("coreCount", form) as number;

  const gpuCount = Form.useWatch("gpuCount", form) as number;

  // 获取集群信息
  const clusterInfoQuery = useAsync({
    promiseFn: useCallback(async () => cluster
      ? await api.getClusterInfo({ query: { cluster:  cluster?.id } }) : undefined, [cluster]),
    onResolve: (data) => {
      const jobInitialName = genJobName();
      form.setFieldValue("jobName", jobInitialName);

      // TODO 调度器类别,K8S镜像
      const schedulerName = data?.clusterInfo.scheduler.name;

    },
  });

  const { defaultCluster: currentDefaultCluster } = useStore(DefaultClusterStore);
  // 判断是使用template中的cluster还是系统默认cluster，
  const defaultCluster = initial.cluster ?? currentDefaultCluster;

  const calculateWorkingDirectory = (template: string, homePath: string = "") =>
    join(homePath + "/", parsePlaceholder(template, { name: jobName }));

  const { data: homePath, isLoading: isHomePathLoading } = useAsync({
    promiseFn: useCallback(async () => cluster
      ? api.getHomeDirectory({ query: { cluster: cluster.id } }) : { path: "" }, [cluster?.id]),
  });

  const setWorkingDirectoryValue = () => {
    if (!form.isFieldTouched("workingDirectory") && clusterInfoQuery.data) {
      form.setFieldValue("workingDirectory",
        calculateWorkingDirectory(clusterInfoQuery.data.clusterInfo.submitJobDirTemplate, homePath?.path));
    }
  };

  useEffect(() => {
    setWorkingDirectoryValue();
  }, [jobName, clusterInfoQuery.data, homePath?.path]);

  // 集群，账户，分区，qos的模板值存在时, 手动控制模板值填入时机
  const excludedFields = ["cluster", "account", "partition", "qos"];
  const initialWithoutExcluded = Object.fromEntries(
    Object.entries(initial).filter(([key]) => !excludedFields.includes(key)),
  );

  const [accountsReloadTrigger, setAccountsReloadTrigger] = useState<boolean>(false);
  const [partitionsReloadTrigger, setPartitionsReloadTrigger] = useState<boolean>(false);
  const [accountPartitionsCacheMap, setAccountPartitionsCacheMap] = useState<Record<string, Partition[]>>({});
  const [selectableAccounts, setSelectableAccounts] = useState<string[]>([]);
  const [selectablePartitions, setSelectablePartitions] = useState<string[]>([]);
  const [isFirstAccountsQuery, setIsFirstAccountsQuery] = useState<boolean>(true);
  const [isFirstParQuery, setIsFirstParQuery] = useState<boolean>(true);
  const [currentPartitionInfo, setCurrentPartitionInfo] = useState<Partition | undefined>();

  const handleAccountsReload = () => {
    setAccountsReloadTrigger((prev) => prev = !prev);
  };

  const handlePartitionsReload = () => {
    const account = form.getFieldValue("account");
    // 分区重新获取时，刷新已选择账户的分区信息
    const newPartitionsMap = { ...accountPartitionsCacheMap };
    if (accountPartitionsCacheMap[account]) {
      delete newPartitionsMap[account];
    }
    setAccountPartitionsCacheMap(newPartitionsMap);
    handlePartitionCacheMap(newPartitionsMap);
    setPartitionsReloadTrigger((prev) => prev = !prev);
  };

  // 获取未封锁账户
  const unblockedAccountsQuery = useAsync({
    promiseFn: useCallback(async () => {
      // 每当账户重新获取时，就清除所有保存的账户分区缓存信息
      setAccountPartitionsCacheMap({});
      handlePartitionCacheMap({});

      return cluster ? await api.getAccounts({ query: {
        cluster: cluster.id,
        statusFilter: AccountStatusFilter.UNBLOCKED_ONLY,
      } })
        .httpError(404, (error) => { message.error(error.message); })
        : { accounts: [] as string [] };
    }, [cluster, accountsReloadTrigger]),
    onResolve: (data) => {

      if (isFirstAccountsQuery) {
        // 如果第一次查询账户列表时模板值中账户存在，则填入模板值的账户，分区,qos
        if (initial.account) {
          form.setFieldValue("account", initial.account);
          form.setFieldValue("partition", initial.partition ?? undefined);
          form.setFieldValue("qos", initial.qos ?? undefined);
        }
        // 第一次请求已经处理过
        setIsFirstAccountsQuery(false);
      } else {
        if (data.accounts && data.accounts.length > 0) {
          setSelectableAccounts(data.accounts);
        }
      }
    },
  });

  // 获取账户的可见分区
  const availablePartitionsForAccountQuery = useAsync({
    promiseFn: useCallback(async () => {
      const account = form.getFieldValue("account");
      if (cluster && account && selectableAccounts.includes(account) && !accountPartitionsCacheMap[account]) {
        const newPartitionsMap = { ...accountPartitionsCacheMap };
        return await api.getAvailablePartitionsForCluster({ query: {
          cluster: cluster?.id,
          accountName: account,
        } })
          .then((data) => {
            newPartitionsMap[account] = data.partitions;
            // 如果第一次请求时模板值中分区存在，则填入模板值的分区及qos
            if (isFirstParQuery && initial.partition && initial.qos) {
              form.setFieldValue("partition", initial.partition);
              form.setFieldValue("qos", initial.partition);
              // 第一次请求已经处理过
              setIsFirstParQuery(false);
            } else {
              if (data && data.partitions && data.partitions.length > 0) {
                form.setFieldValue("partition", data.partitions[0].name);
                form.setFieldValue("qos", data.partitions[0].qos?.[0]);
              }
            }

            setAccountPartitionsCacheMap(newPartitionsMap);
            handlePartitionCacheMap(newPartitionsMap);
          });
      };
      return { partitions: [] as Partition[] };
    }, [selectableAccounts, partitionsReloadTrigger]),
  });


  // 根据当前缓存的账户分区列表获取当前选择的分区信息
  const handlePartitionCacheMap = (cacheMap: Record<string, Partition[]>) => {
    const account = form.getFieldValue("account");
    const partition = form.getFieldValue("partition");

    if (account && Object.keys(cacheMap).length === 0) {
      setCurrentPartitionInfo(undefined);
    } else {
      if (account && cacheMap[account]) {
        setSelectablePartitions(cacheMap[account].map((x) => x.name));
        if (partition && cacheMap[account].find((x) => x.name === partition)) {
          setCurrentPartitionInfo(cacheMap[account].find((x) => x.name === partition));
        } else {
          setCurrentPartitionInfo(cacheMap[account][0]);
        }
      }
    }
  };

  // 集群手动变更时
  const handleClusterChange = () => {
    handleAccountsReload();
    form.setFieldValue("account", selectableAccounts[0]);
    setAccountPartitionsCacheMap({});
    handlePartitionCacheMap({});
    setIsFirstAccountsQuery(false);
    handleAccountChange(selectableAccounts[0]);
  };

  // 账户手动变更时
  const handleAccountChange = (account: string) => {
    const cacheMap = accountPartitionsCacheMap[account];
    if (cacheMap) {
      handlePartitionCacheMap(accountPartitionsCacheMap);
      form.setFieldsValue({ partition: cacheMap[0].name, qos: cacheMap[0].qos?.[0] });
    } else {
      setIsFirstParQuery(false);
      handlePartitionsReload();
    }
  };

  // 分区手动变更时
  const handlePartitionChange = (partition: string) => {
    const account = form.getFieldValue("account");
    const partitionInfo = accountPartitionsCacheMap[account]
      ? accountPartitionsCacheMap[account].find((x) => x.name === partition)
      : undefined;
    setCurrentPartitionInfo(partitionInfo);
    form.setFieldValue("qos", partitionInfo?.qos?.[0]);
  };


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
    <Form<JobForm>
      form={form}
      initialValues={{
        ...initialWithoutExcluded,
        cluster: defaultCluster,
      }}
      onFinish={submit}
    >
      <Row gutter={4}>
        <Col span={24} sm={12}>
          <Form.Item<JobForm> label={t(p("cluster"))} name="cluster" rules={[{ required: true }]}>
            <SingleClusterSelector onChange={handleClusterChange} />
          </Form.Item>
        </Col>
        <Col span={24} sm={12}>
          <Form.Item<JobForm> label={t(p("jobName"))} name="jobName" rules={[{ required: true }, { max: 50 }]}>
            <Input />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item<JobForm>
        label={t(p("command"))}
        name="command"
        rules={[{ required: true }]}
      >
        <CodeEditor
          height="50vh"
          placeholder={submitJobPromptText}
        />
      </Form.Item>
      <Row gutter={4}>
        <Col span={24} sm={12}>
          <Form.Item
            label={t(p("account"))}
            name="account"
            rules={[{ required: true }]}
            dependencies={["cluster"]}
          >
            {/* 加载完集群后再加载账户，保证initial值能被赋值成功 */}
            { cluster?.id && unblockedAccountsQuery?.data?.accounts &&
              (
                <AccountListSelector
                  selectableAccounts={ selectableAccounts ?? []}
                  isLoading={unblockedAccountsQuery.isLoading}
                  onReload={handleAccountsReload}
                  onChange={handleAccountChange}
                />
              )}
          </Form.Item>
        </Col>
        <Col span={24} sm={6}>
          <Form.Item
            label={t(p("partition"))}
            name="partition"
            dependencies={["cluster", "account"]}
            rules={[{ required: true }]}
          >
            <PartitionSelector
              isLoading={availablePartitionsForAccountQuery.isLoading || unblockedAccountsQuery.isLoading}
              selectablePartitions={selectablePartitions ?? []}
              onReload={handlePartitionsReload}
              onChange={handlePartitionChange}
            />
          </Form.Item>
        </Col>
        <Col span={24} sm={6}>
          <Form.Item
            label={t(p("qos"))}
            name="qos"
            dependencies={["cluster", "account", "partition"]}
            rules={[{ required: true }]}
          >
            <Select
              loading={availablePartitionsForAccountQuery.isLoading || unblockedAccountsQuery.isLoading}
              options={currentPartitionInfo?.qos?.map((x) => ({ label: x, value: x }))}

            />
          </Form.Item>
        </Col>
        <Col span={12} sm={6}>
          <Form.Item
            label={t(p("nodeCount"))}
            name="nodeCount"
            dependencies={["cluster", "account", "partition"]}
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
        </Col>
        <Col span={12} sm={6}>
          {currentPartitionInfo?.gpus ? (
            <Form.Item
              label={t(p("gpuCount"))}
              name="gpuCount"
              dependencies={["cluster", "account", "partition"]}
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
              dependencies={["cluster", "account", "partition"]}
              rules={[
                {
                  required: true,
                  type: "integer",
                  max: currentPartitionInfo ? currentPartitionInfo.cores / currentPartitionInfo.nodes : undefined,
                },
              ]}
            >
              <InputNumber
                min={1}
                max={currentPartitionInfo ? currentPartitionInfo.cores / currentPartitionInfo.nodes : undefined}
                {...inputNumberFloorConfig}
              />
            </Form.Item>
          )}
        </Col>
        <Col span={24} sm={12}>
          <Form.Item label={t(p("maxTime"))} name="maxTime" rules={[{ required: true }]}>
            <InputNumber min={1} step={1} addonAfter={t(p("minute"))} />
          </Form.Item>
        </Col>
        <Col span={24} sm={10}>
          <Form.Item<JobForm>
            label={t(p("workingDirectory"))}
            name="workingDirectory"
            rules={[{ required: true }]}
            tooltip={(
              <>
                <span>{t(p("wdTooltip1"))}</span>
                <br />
                <span>{t(p("wdTooltip2"))}</span>
              </>
            )}
          >
            <Input
              suffix={
                (
                  <FileSelectModal
                    onSubmit={(path: string) => {
                      form.setFields([{ name: "workingDirectory", value: path, touched: true }]);
                      form.validateFields(["workingDirectory"]);
                    }}
                    cluster={cluster || defaultCluster}
                  />
                )
              }
            />
          </Form.Item>
        </Col>
        <Col span={24} sm={7}>
          <Form.Item<JobForm> label={t(p("output"))} name="output" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Col>
        <Col span={24} sm={7}>
          <Form.Item<JobForm> label={t(p("errorOutput"))} name="errorOutput" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Col>
        <Col className="ant-form-item" span={12} sm={6}>
          {t(p("totalNodeCount"))}{nodeCount}
        </Col>

        {currentPartitionInfo?.gpus ? (
          <Col className="ant-form-item" span={12} sm={6}>
            {t(p("totalGpuCount"))}{nodeCount * gpuCount}
          </Col>
        ) : (
          ""
        )}

        <Col className="ant-form-item" span={12} sm={6}>
          {t(p("totalCoreCount"))}{coreCountSum}
        </Col>
        <Col className="ant-form-item" span={12} sm={6}>
          {t(p("totalMemory"))}{memoryDisplay}
        </Col>
      </Row>
      <Form.Item label={t(p("comment"))} name="comment">
        <Input.TextArea />
      </Form.Item>
      <Form.Item name="save" valuePropName="checked">
        <Checkbox>{t(p("saveToTemplate"))}</Checkbox>
      </Form.Item>
      <Button type="primary" htmlType="submit" loading={loading || isHomePathLoading}>
        {t("button.submitButton")}
      </Button>
    </Form>
  );
};
