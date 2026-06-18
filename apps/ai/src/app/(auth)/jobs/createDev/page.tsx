"use client";

import { LoadingOutlined } from "@ant-design/icons";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { usePublicConfig } from "src/app/(auth)/context";
import { useI18nTranslateToString } from "src/i18n";
import { useDocumentTitle } from "src/utils/head";
import { trpc } from "src/utils/trpc";

import { FullWidthContainer } from "../common";
import { LaunchDevForm } from "./LaunchDevForm";

export default function Page() {
  const searchParams = useSearchParams();
  const t = useI18nTranslateToString();

  useDocumentTitle(t("app.jobs.launchDevForm.title"));

  const { publicConfig } = usePublicConfig();

  const queryParams = useMemo(() => {
    if (!searchParams) {
      return {};
    }
    return Object.fromEntries(searchParams.entries());
  }, [searchParams]) as Record<string, string | undefined>;

  // 再次提交时使用的参数
  const jobId = queryParams.jobId;
  const sessionId = queryParams.sessionId;
  const clusterId = queryParams.clusterId;

  const resubmitInput = useMemo(() => {
    if (!jobId || !sessionId || !clusterId) {
      return null;
    }
    const parsedJobId = Number.parseInt(jobId, 10);
    if (Number.isNaN(parsedJobId)) {
      return null;
    }
    return {
      clusterId,
      jobId: parsedJobId,
      sessionId,
    };
  }, [clusterId, jobId, sessionId]);

  const emptyParams = useMemo(() => ({ clusterId: "", jobId: 0, sessionId: "" }), []);
  const { data: createDevParams, isLoading: isCreateDevParamsLoading } = trpc.devHost.getCreateDevParams.useQuery(
    resubmitInput ?? emptyParams,
    {
      enabled: Boolean(resubmitInput),
      retry: false,
    },
  );

  if (resubmitInput && isCreateDevParamsLoading) {
    return (
      <FullWidthContainer>
        <LoadingOutlined />
      </FullWidthContainer>
    );
  }

  return (
    <LaunchDevForm
      createDevParams={resubmitInput ? createDevParams : undefined}
      misPath={publicConfig.MIS_URL ?? "/mis"}
    />
  );
}
