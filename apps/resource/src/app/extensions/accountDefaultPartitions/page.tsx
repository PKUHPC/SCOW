"use client";

import { Head } from "@scow/lib-web/build/components/head";
import { App } from "antd";
import { useContext, useEffect } from "react";
import { PageTitle } from "src/components/PageTitle";
import { ScowParamsContext } from "src/components/ScowParamsProvider";
import { trpc } from "src/server/trpc/api";
import { getLanguage } from "src/utils/i18n";

import { AccountDefaultPartitionsTable } from "./AccountDefaultPartitionsTable";

export default function Page() {
  const { scowLangId } = useContext(ScowParamsContext);
  const language = getLanguage(scowLangId);

  const { message } = App.useApp();

  useEffect(() => {
    window.parent?.postMessage(
      {
        type: "scow.extensionPageTitleChanged",
        payload: {
          title: language.accountDefaultPartitions.title,
        },
      },
      "*",
    );
  }, [language]);

  const { data: userData, isLoading: userInfoIsLoading } = trpc.auth.getUserInfo.useQuery();
  const tenantNameQuery = userData?.user.tenant;

  const { data, refetch, isFetching, error } = trpc.partitions.accountDefaultPartitions.useQuery(
    { tenantName: tenantNameQuery ?? "" },
    {
      enabled: !!tenantNameQuery,
    },
  );

  if (error) {
    message.error(language.accountDefaultPartitions.defaultAccountPartitionsNotFoundError);
  }

  const {
    data: defaultClustersData,
    refetch: defaultClustersRefetch,
    isFetching: defaultClustersIsFetching,
    error: defaultClustersError,
  } = trpc.partitions.accountDefaultClusters.useQuery(
    { tenantName: tenantNameQuery ?? "" },
    {
      enabled: !!tenantNameQuery,
    },
  );

  if (defaultClustersError) {
    message.error(language.accountDefaultClusters.defaultAccountClustersNotFoundError);
  }

  const handleReload = () => {
    refetch();
    defaultClustersRefetch();
  };
  return (
    <div>
      <Head title={language.accountDefaultPartitions.title} />
      <PageTitle titleText={language.accountDefaultPartitions.title}></PageTitle>
      <AccountDefaultPartitionsTable
        data={data?.assignedPartitions}
        defaultClusterIds={defaultClustersData?.assignedClusters}
        tenantName={tenantNameQuery}
        isLoading={isFetching && userInfoIsLoading && defaultClustersIsFetching}
        reload={() => {
          handleReload();
        }}
        language={language}
        languageId={scowLangId}
      />
    </div>
  );
}
