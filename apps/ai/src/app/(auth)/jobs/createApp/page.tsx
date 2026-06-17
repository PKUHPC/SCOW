"use client";

import { RoundedSearch } from "@scow/lib-web/build/components/styledAntdCom/Input";
import { Form, Space, Spin } from "antd";
import { useEffect, useMemo, useState } from "react";
import { usePublicConfig } from "src/app/(auth)/context";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { ServerErrorPage } from "src/layouts/error/ServerErrorPage";
import { useDocumentTitle } from "src/utils/head";
import { trpc } from "src/utils/trpc";
import { styled } from "styled-components";

import { SelectAppTable } from "./SelectAppTable";

const SearchContainer = styled(Space)`
  width: 100%;
  margin-bottom: 20px;
  display: flex;
  justify-content: flex-end;
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
  return trpc.jobs.listAllAvailableAppsFromAllClusters.useQuery();
};

export default function Page() {
  const t = useI18nTranslateToString();
  const p = prefix("app.jobs.createApps.");

  const { publicConfig } = usePublicConfig();

  const [filterForm] = Form.useForm<FilterForm>();
  const initialFilterQuery = {
    appName: undefined,
  };
  const [query, setQuery] = useState<FilterForm>(initialFilterQuery);

  const { data, isLoading, isError } = useClusterAppConfigQuery();

  useDocumentTitle(t(p("title")));

  // 前端过滤查询结果
  const filteredData = useMemo(() => {
    if (!data?.apps || isLoading) return undefined;

    // 确保 query.appName 是有效的字符串
    const searchTerm = query.appName?.trim().toLowerCase() || "";
    if (!searchTerm) {
      return data;
    }
    const filteredValues = data.apps.filter((app) => app.name.toLowerCase().includes(searchTerm));
    return { apps: filteredValues };
  }, [data, isLoading, query.appName]);

  useEffect(() => {
    filterForm.resetFields();
    setQuery(initialFilterQuery);
  }, [filterForm]);

  if (isError) {
    return <ServerErrorPage />;
  }

  return (
    <Spin spinning={isLoading} tip={isLoading ? t(p("loading")) : ""} style={{ marginTop: "150px" }}>
      <PageTitle titleText={t(p("title"))} />
      <SearchContainer>
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
        <SelectAppTable publicPath={publicConfig.PUBLIC_PATH} apps={filteredData?.apps ?? []} />
      )}
    </Spin>
  );
}
