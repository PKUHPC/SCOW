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

"use client";

import { LoadingOutlined } from "@ant-design/icons";
import { useSearchParams } from "next/navigation";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { trpc } from "src/utils/trpc";

import { LaunchAppForm } from "../LaunchAppForm";

export default function Page({ params }: { params: { clusterId: string } }) {
  const t = useI18nTranslateToString();
  const p = prefix("app.jobs.trainJobs.");

  const { clusterId } = params;

  const searchParams = useSearchParams();

  const jobId = searchParams?.get("jobId");
  const sessionId = searchParams?.get("sessionId");

  const parsedJobId = jobId ? parseInt(jobId, 10) : null;

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


