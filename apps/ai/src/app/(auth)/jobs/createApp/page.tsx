"use client";

import { TrimInput as Input } from "@scow/lib-web/build/components/styledAntdCom/TrimInput";
import { Button, Form, Space } from "antd";
import { useEffect, useMemo, useState } from "react";
import { usePublicConfig } from "src/app/(auth)/context";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { ServerErrorPage } from "src/layouts/error/ServerErrorPage";
import { useDocumentTitle } from "src/utils/head";
import { trpc } from "src/utils/trpc";

import { SelectAppTable } from "./SelectAppTable";

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
    const filteredValues = data.apps
      .filter((app) => app.name.toLowerCase().includes(searchTerm));
    return { apps: filteredValues };

  }, [data, isLoading, query.appName]);

  useEffect(() => {
    filterForm.resetFields();
    setQuery(initialFilterQuery);
  }, [filterForm]);

  if (isError) {
    return (
      <ServerErrorPage />
    );
  }

  return (
    <>
      {
        isLoading ? (
          <div style={{ textAlign: "center", marginTop: "100px" }}>
            <p>loading...</p>
          </div>
        ) : (
          <>
            <PageTitle
              titleText={t(p("title"))}
            />
            <Space style={{ marginBottom: "20px", display: "flex", justifyContent: "flex-end" }}>
              <Form<FilterForm>
                layout="inline"
                form={filterForm}
                initialValues={initialFilterQuery}
                onFinish={async () => {
                  const { appName } = await filterForm.validateFields();
                  setQuery({ appName: appName === "" ? undefined : appName?.trim() });
                }}
              >
                <Form.Item name="appName">
                  <Input allowClear placeholder={t(p("searchPlaceholder"))} />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit">
                    {t("button.searchButton")}
                  </Button>
                </Form.Item>
              </Form>
            </Space>
            {
              !filteredData?.apps || filteredData.apps.length === 0 ? (
                <div style={{ textAlign: "center", marginTop: "100px", fontSize: "16px" }}>
                  {query.appName ? t(p("noSearchResult"), [query.appName]) : t(p("appNotFoundMessage"))}
                </div>
              ) : (
                <SelectAppTable
                  publicPath={publicConfig.PUBLIC_PATH}
                  apps={filteredData.apps}
                  basePath={publicConfig.BASE_PATH}
                />
              )
            }
          </>
        )
      }
    </>
  );
}
