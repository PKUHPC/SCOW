"use client";

import { Head } from "@scow/lib-web/build/components/head";
import { useContext, useEffect } from "react";
import { PartitionManagementTable } from "src/components/pageComponents/ClusterPartitionManagementTable";
import { PageTitle } from "src/components/PageTitle";
import { ScowParamsContext } from "src/components/ScowParamsProvider";
import { PartitionOperationType } from "src/models/partition";
import { trpc } from "src/server/trpc/api";
import { getLanguage } from "src/utils/i18n";

export default function Page() {
  const { scowLangId } = useContext(ScowParamsContext);
  const language = getLanguage(scowLangId);

  const { data: userData } = trpc.auth.getUserInfo.useQuery();
  const tenantNameQuery = userData?.user.tenant;

  useEffect(() => {
    window.parent?.postMessage(
      {
        type: "scow.extensionPageTitleChanged",
        payload: {
          title: language.clusterPartitionManagement.common.head,
        },
      },
      "*",
    );
  }, [language]);

  return (
    <div>
      <Head title={language.clusterPartitionManagement.common.head} />
      <PageTitle titleText={language.clusterPartitionManagement.common.head}></PageTitle>
      <PartitionManagementTable
        operationType={PartitionOperationType.ACCOUNT_OPERATION}
        language={language}
        languageId={scowLangId}
        tenantName={tenantNameQuery}
      />
    </div>
  );
}
