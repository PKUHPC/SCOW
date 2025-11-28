"use client";
import { LoadingOutlined } from "@ant-design/icons";
import { useSearchParams } from "next/navigation";
import { use } from "react";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { useDocumentTitle } from "src/utils/head";
import { trpc } from "src/utils/trpc";

import { LaunchAppForm } from "../LaunchAppForm";

export default function Page(props: { params: Promise<{ clusterId: string }> }) {
  const params = use(props.params);
  const t = useI18nTranslateToString();
  const p = prefix("app.jobs.trainJobs.");

  const { clusterId } = params;

  const searchParams = useSearchParams();

  const jobId = searchParams?.get("jobId");
  const sessionId = searchParams?.get("sessionId");

  const parsedJobId = jobId ? parseInt(jobId, 10) : null;

  useDocumentTitle(t(p("title")));

  const { data: submitTrainParams, isLoading: isSubmitTrainParamsLoading } = trpc.jobs.getSubmitTrainParams.useQuery(
    { clusterId, jobId: parsedJobId!, sessionId: sessionId! }, {
      enabled: (!!jobId && !!sessionId),
      retry: false,
    });

  if (!!jobId && !!sessionId && (isSubmitTrainParamsLoading)) {
    return <LoadingOutlined />;
  }

  return (
    <div>
      <PageTitle titleText={t(p("title"))} />
      <LaunchAppForm
        clusterId={clusterId}
        isTraining={true}
        trainJobInput={submitTrainParams}
      />
    </div>
  );
}


