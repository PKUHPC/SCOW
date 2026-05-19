import { Button, Form, message, Select, Space } from "antd";
import { NextPage } from "next";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAsync } from "react-async";
import { useStore } from "simstate";
import { api } from "src/apis";
import { requireAuth } from "src/auth/requireAuth";
import { SingleClusterSelector } from "src/components/ClusterSelector";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { Partition } from "src/models/cluster";
import { TenantRole } from "src/models/User";
import { ManageJobBillingTable } from "src/pageComponents/job/ManageJobBillingTable";
import { BillingItemType } from "src/pages/api/job/getBillingItems";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { Cluster } from "src/utils/cluster";
import { Head } from "src/utils/head";

const p = prefix("page.tenant.jobBillingTable.");
const pCommon = prefix("common.");

const TenantJobBillingTableContent: React.FC<{ tenant: string }> = ({ tenant }) => {
  const t = useI18nTranslateToString();

  const [selectedCluster, setSelectedCluster] = useState<Cluster | undefined>(undefined);
  const [selectedPartitionId, setSelectedPartitionId] = useState<string | undefined>(undefined);
  const [selectedQos, setSelectedQos] = useState<string | undefined>(undefined);

  const [submittedCluster, setSubmittedCluster] = useState<Cluster | undefined>(undefined);
  const [submittedPartitionId, setSubmittedPartitionId] = useState<string | undefined>(undefined);
  const [submittedQos, setSubmittedQos] = useState<string | undefined>(undefined);

  const [fetchedPartitions, setFetchedPartitions] = useState<Partition[] | undefined>(undefined);

  // 获取集群信息
  const { clusterSortedIdList, activatedClusters } = useStore(ClusterInfoStore);
  const currentActivatedClusterIds = useMemo(() => {
    return Object.keys(activatedClusters);
  }, [activatedClusters]);

  // 用 ref 记录上一次的 cluster id，避免重复请求
  const prevClusterIdRef = useRef<string | undefined>();
  const [isPartitionLoading, setIsPartitionLoading] = useState(false);

  // 加载集群分区
  const loadPartitions = useCallback(async (clusterId: string) => {
    setIsPartitionLoading(true);
    try {
      const result = await api.getClusterConfig({
        query: {
          cluster: clusterId,
        },
      });
      setFetchedPartitions(result.partitions);
    } catch {
      message.error(t(p("getClusterErrorMessage")));
      setFetchedPartitions([]);
    } finally {
      setIsPartitionLoading(false);
    }
  }, []);

  // 只在 selectedCluster.id 真正变化时才请求
  useEffect(() => {
    const currentClusterId = selectedCluster?.id;

    if (currentClusterId && currentClusterId !== prevClusterIdRef.current) {
      prevClusterIdRef.current = currentClusterId;
      loadPartitions(currentClusterId);
    } else if (!currentClusterId && prevClusterIdRef.current) {
      prevClusterIdRef.current = undefined;
      setFetchedPartitions(undefined);
    }
  }, [selectedCluster?.id, loadPartitions]);

  // 加载计费项 - 只依赖已提交的筛选条件
  const { data, isLoading, reload } = useAsync({
    promiseFn: useCallback(async () => {
      // 租户是固定的，查询所有集群数据，以便在前端进行筛选
      return await api
        .getBillingItems({
          query: {
            tenant: tenant,
            activeOnly: false,
            currentActivatedClusterIds,
            clusterSortedIdList: clusterSortedIdList,
          },
        })
        .httpError(409, () => {
          message.error(t("common.failedGetTenantAssignedClustersAndPartitions"));
          return undefined;
        })
        .then((result) => {
          return result;
        });
    }, [tenant, currentActivatedClusterIds, clusterSortedIdList]),
    defer: true,
  });

  // 找到当前选中的分区对象
  const currentPartition = useMemo(() => {
    return fetchedPartitions?.find((p) => p.name === selectedPartitionId);
  }, [selectedPartitionId, fetchedPartitions]);

  // QoS 选项列表 (依赖于选中的分区)
  const qosOptions = useMemo(() => {
    return currentPartition?.qos?.map((q) => ({ value: q, label: q })) || [];
  }, [currentPartition]);

  // 分区选项列表 (依赖于获取到的分区数据)
  const partitionOptions = useMemo(() => {
    return fetchedPartitions?.map((p) => ({ value: p.name, label: p.name })) || [];
  }, [fetchedPartitions]);

  // 前端筛选逻辑 - 使用已提交的筛选条件
  const filterBillingItem = useCallback(
    (item: BillingItemType) => {
      let passesCluster = true;
      let passesPartition = true;
      let passesQos = true;

      // 1. 集群筛选 (前端筛选)
      if (submittedCluster) {
        passesCluster = item.cluster === submittedCluster.id;
      }

      // 2. 分区筛选
      if (submittedPartitionId) {
        passesPartition = item.partition === submittedPartitionId;
      }

      // 3. QoS 筛选
      if (submittedQos) {
        passesQos = item.qos === submittedQos;
      }

      return passesCluster && passesPartition && passesQos;
    },
    [submittedCluster, submittedPartitionId, submittedQos],
  );

  const filteredData = useMemo(() => {
    if (!data) return undefined;

    // 只有当任一筛选条件被选中时才执行筛选
    const shouldFilter = Boolean(submittedCluster || submittedPartitionId || submittedQos);
    if (!shouldFilter) return data;

    return {
      ...data,
      activeItems: data.activeItems.filter(filterBillingItem),
      historyItems: data.historyItems.filter(filterBillingItem),
    };
  }, [data, submittedCluster, submittedPartitionId, submittedQos, filterBillingItem]);

  // 处理搜索按钮点击
  const handleSearch = useCallback(() => {
    // 提交当前选择的筛选条件
    setSubmittedCluster(selectedCluster);
    setSubmittedPartitionId(selectedPartitionId);
    setSubmittedQos(selectedQos);

    // 触发数据加载
    reload();
  }, [selectedCluster, selectedPartitionId, selectedQos, reload]);

  const handleReload = useCallback(() => {
    // 如果选中了集群，重新加载分区配置
    if (selectedCluster) {
      loadPartitions(selectedCluster.id);
    }

    // 重新加载价格表数据
    reload();
  }, [selectedCluster, loadPartitions, reload]);

  return (
    <div>
      {currentActivatedClusterIds.length === 0 && (
        <div style={{ marginBottom: 20 }}>{t("common.noAvailableClusters")}</div>
      )}
      <FilterFormContainer>
        <Form layout="inline" style={{ marginTop: 8 }}>
          <Form.Item label={t(pCommon("cluster"))}>
            <SingleClusterSelector
              value={selectedCluster}
              onChange={(newCluster) => {
                setSelectedCluster(newCluster);
                setSelectedPartitionId(undefined);
                setSelectedQos(undefined);
              }}
              allowClear={true}
              showSearch={true}
            />
          </Form.Item>

          <Form.Item label={t(pCommon("partition"))}>
            <Select
              showSearch
              key={selectedCluster?.id || "no-cluster"}
              placeholder={selectedCluster ? t(p("selectPartition")) : t(p("selectClusterFirst"))}
              value={selectedPartitionId}
              onChange={(value: string | undefined) => {
                setSelectedPartitionId(value);
                setSelectedQos(undefined);
              }}
              options={partitionOptions}
              style={{ minWidth: 120 }}
              loading={isPartitionLoading}
              disabled={!selectedCluster}
              allowClear={true}
            />
          </Form.Item>

          <Form.Item label={t(p("qos"))}>
            <Select
              showSearch
              key={selectedPartitionId ?? "no-partition"}
              placeholder={selectedPartitionId ? t(p("selectQos")) : t(p("selectPartitionFirst"))}
              value={selectedQos}
              onChange={(value: string | undefined) => {
                setSelectedQos(value);
              }}
              options={qosOptions}
              style={{ minWidth: 120 }}
              disabled={!selectedPartitionId || qosOptions.length === 0}
              allowClear={true}
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" loading={isLoading} onClick={handleSearch}>
                {t("common.search")}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </FilterFormContainer>
      <ManageJobBillingTable
        data={filteredData}
        loading={isLoading}
        tenant={tenant}
        reload={handleReload}
        isFromPlatformAdmin={false}
      />
    </div>
  );
};

export const TenantAdminJobBillingTablePage: NextPage = requireAuth((x) =>
  x.tenantRoles.includes(TenantRole.TENANT_ADMIN),
)(({ userStore }) => {
  const tenant = userStore.user.tenant;
  const t = useI18nTranslateToString();

  return (
    <div>
      <Head title={t(p("manageTenantJobPriceTable"))} />
      <PageTitle titleText={t("common.jobBillingTable")} />
      <TenantJobBillingTableContent tenant={tenant} />
    </div>
  );
});

export default TenantAdminJobBillingTablePage;
