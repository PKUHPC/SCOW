"use client";

import { RoundedButton } from "@scow/lib-web/build/components/styledAntdCom/Button";
import { RoundedSearch } from "@scow/lib-web/build/components/styledAntdCom/Input";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { Form, Space, Spin } from "antd";
import { useEffect, useMemo, useState } from "react";
import { usePublicConfig } from "src/app/(auth)/context";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { ServerErrorPage } from "src/layouts/error/ServerErrorPage";
import { useDocumentTitle } from "src/utils/head";
import { trpc } from "src/utils/trpc";
import { styled } from "styled-components";

import { SelectAppTable } from "./SelectAppTable";

const SearchContainer = styled(Space)`
  width: 100%;
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  background: ${({ theme }) => theme.token.colorBgContainer};
  border-radius: 12px;
  padding: 12px 10px 16px 20px;
`;

const AppSearch = styled(RoundedSearch)`
  height: 36px !important;
  overflow: hidden;

  .ant-input-group,
  .ant-input-wrapper {
    height: 100%;
  }

  .ant-input {
    height: 100%;
    line-height: 34px;
  }
`;

interface FilterForm {
  appName: string | undefined;
}

const useClusterAppConfigQuery = () => {
  const { publicConfig, currentAvailableClusterIds } = usePublicConfig();

  const currentClusters = publicConfig.CLUSTERS.filter((cluster) => currentAvailableClusterIds.includes(cluster.id));

  return trpc.jobs.listAvailableApps.useQuery(
    { clusterIds: currentClusters.map((cluster) => cluster.id) },
    { enabled: currentClusters.length > 0 },
  );
};

export default function Page() {
  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;
  const p = prefix("app.jobs.createApps.");

  const {
    publicConfig,
    currentAvailableClusterIds,
    defaultClusterContext: { defaultCluster, setDefaultCluster },
  } = usePublicConfig();

  const currentClusters = useMemo(
    () => publicConfig.CLUSTERS.filter((cluster) => currentAvailableClusterIds.includes(cluster.id)),
    [currentAvailableClusterIds, publicConfig.CLUSTERS],
  );

  const [filterForm] = Form.useForm<FilterForm>();
  const initialFilterQuery = {
    appName: undefined,
  };
  const [query, setQuery] = useState<FilterForm>(initialFilterQuery);
  const [selectedCluster, setSelectedCluster] = useState<string | undefined>(defaultCluster?.id);

  const { data, isLoading, isError } = useClusterAppConfigQuery();

  useDocumentTitle(t(p("title")));

  const clusterOptions = useMemo(() => {
    if (!data) {
      return [];
    }

    const clusterIdsWithAuthorizedApps = new Set(
      data.filter((clusterData) => clusterData.apps.length > 0).map((clusterData) => clusterData.clusterId),
    );

    return currentClusters.filter((cluster) => clusterIdsWithAuthorizedApps.has(cluster.id));
  }, [currentClusters, data]);

  useEffect(() => {
    if (clusterOptions.length === 0) {
      if (selectedCluster) {
        setSelectedCluster(undefined);
      }
      return;
    }

    if (!selectedCluster || !clusterOptions.some((cluster) => cluster.id === selectedCluster)) {
      const nextCluster = clusterOptions.find((cluster) => cluster.id === defaultCluster?.id) ?? clusterOptions[0];
      setSelectedCluster(nextCluster.id);
      setDefaultCluster(nextCluster);
    }
  }, [clusterOptions, defaultCluster, selectedCluster, setDefaultCluster]);

  // 前端过滤查询结果
  const filteredData = useMemo(() => {
    if (!data || isLoading || !selectedCluster) return undefined;

    const selectedClusterData = data.find((clusterData) => clusterData.clusterId === selectedCluster);
    const apps = selectedClusterData?.apps ?? [];

    // 确保 query.appName 是有效的字符串
    const searchTerm = query.appName?.trim().toLowerCase() || "";
    if (!searchTerm) {
      return { apps };
    }
    const filteredValues = apps.filter((app) => app.name.toLowerCase().includes(searchTerm));
    return { apps: filteredValues };
  }, [data, isLoading, query.appName, selectedCluster]);

  useEffect(() => {
    filterForm.resetFields();
    setQuery(initialFilterQuery);
  }, [filterForm, selectedCluster]);

  if (isError) {
    return <ServerErrorPage />;
  }

  return (
    <Spin spinning={isLoading} tip={isLoading ? t(p("loading")) : ""} style={{ marginTop: "150px" }}>
      <PageTitle titleText={t(p("title"))} />
      <SearchContainer>
        <Space wrap>
          <span style={{ marginRight: "8px" }}>{t(p("cluster"))}</span>
          {clusterOptions.map((cluster) => (
            <RoundedButton
              size="middle"
              key={cluster.id}
              type={selectedCluster === cluster.id ? "primary" : "default"}
              $selected={selectedCluster === cluster.id}
              $height="32px"
              onClick={() => {
                setSelectedCluster(cluster.id);
                setDefaultCluster(cluster);
              }}
            >
              {getI18nConfigCurrentText(cluster.name, languageId)}
            </RoundedButton>
          ))}
        </Space>
        <Form<FilterForm> layout="inline" form={filterForm} initialValues={initialFilterQuery}>
          <Form.Item name="appName">
            <AppSearch
              placeholder={t(p("searchPlaceholder"))}
              onSearch={async () => {
                const { appName } = await filterForm.validateFields();
                setQuery({ appName: appName === "" ? undefined : appName?.trim() });
              }}
              size="middle"
              enterButton
            />
          </Form.Item>
        </Form>
      </SearchContainer>
      {!isLoading && (!filteredData?.apps || filteredData.apps.length === 0) ? (
        <div style={{ textAlign: "center", marginTop: "100px", fontSize: "16px" }}>
          {query.appName ? t(p("noSearchResult"), [query.appName]) : t(p("appNotFoundMessage"))}
        </div>
      ) : (
        <SelectAppTable
          publicPath={publicConfig.PUBLIC_PATH}
          apps={filteredData?.apps ?? []}
          selectedCluster={selectedCluster}
        />
      )}
    </Spin>
  );
}
