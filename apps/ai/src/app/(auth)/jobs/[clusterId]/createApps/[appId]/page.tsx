"use client";

import { LoadingOutlined } from "@ant-design/icons";
import { useSearchParams } from "next/navigation";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { trpc } from "src/utils/trpc";

import { LaunchAppForm } from "../../LaunchAppForm";


export default function Page({ params }: { params: { clusterId: string, appId: string } }) {

  const t = useI18nTranslateToString();
  const p = prefix("app.jobs.createApps.");

  const { appId, clusterId } = params;
  const searchParams = useSearchParams();

  const jobId = searchParams?.get("jobId");
  const sessionId = searchParams?.get("sessionId");

  const { data: appInfo, isLoading: isAppLoading } = trpc.jobs.getAppMetadata.useQuery({ clusterId, appId });

  const { data: clusterInfo, isLoading: isClusterLoading } = trpc.config.getClusterConfig.useQuery({ clusterId });

  const parsedJobId = jobId ? parseInt(jobId, 10) : null;
  const { data: createAppParams, isLoading: isCreateAppParamsLoading } = trpc.jobs.getCreateAppParams.useQuery(
    { clusterId, jobId: parsedJobId!, sessionId: sessionId! }, {
      enabled: (!!jobId && !!sessionId),
      retry: false,
    });


  if (
    isAppLoading || isClusterLoading
    || !appInfo || !clusterInfo
    || (!!jobId && !!sessionId && (isCreateAppParamsLoading))) {
    return <LoadingOutlined />;
  }

  return (
    <div>
      <PageTitle titleText={`${t(p("create"))} ${appInfo.appName}`} />
      <LaunchAppForm
        appName={appInfo.appName}
        appId={appId}
        clusterId={clusterId}
        attributes={appInfo.attributes}
        appComment={appInfo.appComment}
        clusterInfo={clusterInfo}
        appImage={appInfo.appImage}
        createAppParams={createAppParams}
      />
    </div>
  );
}


