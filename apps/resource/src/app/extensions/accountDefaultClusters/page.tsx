"use client";


import { Cluster } from "@scow/config/build/type";
import { Head } from "@scow/lib-web/build/components/head";
import { App } from "antd";
import { useContext, useEffect } from "react";
import { PageTitle } from "src/components/PageTitle";
import { ScowParamsContext } from "src/components/ScowParamsProvider";
import { trpc } from "src/server/trpc/api";
import { getLanguage } from "src/utils/i18n";

import { AccountDefaultClustersTable } from "./AccountDefaultClustersTable";
import { AddToAccountDefaultClustersButton } from "./AddToAccountDefaultClustersButton";

export default function Page() {

  const { scowLangId } = useContext(ScowParamsContext);
  const language = getLanguage(scowLangId);

  const { message } = App.useApp();

  useEffect(() => {
    window.parent?.postMessage({
      type: "scow.extensionPageTitleChanged",
      payload: {
        title: language.accountDefaultClusters.title,
      },
    }, "*");
  }, [language]);

  const { data: userData, isFetching: userInfoIsLoading } = trpc.auth.getUserInfo.useQuery();
  const tenantNameQuery = userData?.user.tenant;

  const { data, refetch, isFetching, error } = trpc.partitions.accountDefaultClusters.useQuery(
    { tenantName: tenantNameQuery ?? "" },
    {
      enabled: !!tenantNameQuery,
    },
  );

  // 获取当前在线集群
  const { data: currentClustersData,
    refetch: currentClustersRefetch,
    isFetching: currentClustersFetching,
    error: currentClustersError } = trpc.misServer.currentClusters.useQuery();

  if (error) {
    message.error(language.accountDefaultClusters.defaultAccountClustersNotFoundError);
  }
  if (currentClustersError) {
    message.error(language.globalMessage.currentClustersNotFoundError);
  }

  return (
    <div>
      <Head title={language.accountDefaultClusters.title} />
      <PageTitle titleText={language.accountDefaultClusters.title}>

        <AddToAccountDefaultClustersButton
          defaultAssignedClusters={data?.assignedClusters}
          tenantName={tenantNameQuery ?? ""}
          currentClusters={currentClustersData?.results as Cluster[]}
          refresh={refetch}
          language={language}
          languageId={scowLangId}
        />

      </PageTitle>
      <AccountDefaultClustersTable
        assignedClusterIds={data?.assignedClusters}
        currentClusters={currentClustersData?.results as Cluster[]}
        tenantName={tenantNameQuery ?? ""}
        isLoading={isFetching || userInfoIsLoading || currentClustersFetching}
        reload={() => {
          refetch();
          currentClustersRefetch();
        }}
        language={language}
        languageId={scowLangId}
      />
    </div>
  );
}
