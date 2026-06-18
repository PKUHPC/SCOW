"use client";

import { LoadingOutlined } from "@ant-design/icons";
import { App } from "antd";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { usePublicConfig } from "src/app/(auth)/context";
import { useI18nTranslateToString } from "src/i18n";
import { useDocumentTitle } from "src/utils/head";
import { trpc } from "src/utils/trpc";

import { FullWidthContainer } from "../common";
import { LaunchInferForm } from "./LaunchInferForm";

export default function Page() {
  const searchParams = useSearchParams();
  const t = useI18nTranslateToString();
  const { message } = App.useApp();

  useDocumentTitle(t("app.jobs.launchInferForm.title"));
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
  const {
    data: createInferParams,
    error: getCreateInferParamsError,
    isLoading: isCreateInferParamsLoading,
  } =
    trpc.jobs.getSubmitInferenceParams.useQuery(resubmitInput ?? emptyParams, {
      enabled: Boolean(resubmitInput),
      retry: false,
      meta: {
        silent: true,
      },
    });

  useEffect(() => {
    if (!getCreateInferParamsError) {
      return;
    }

    message.error(`${t("app.jobs.launchInferForm.getCreateInferParamsFailed")}: ${getCreateInferParamsError.message}`);
  }, [getCreateInferParamsError, message, t]);

  if (resubmitInput && isCreateInferParamsLoading) {
    return (
      <FullWidthContainer>
        <LoadingOutlined />
      </FullWidthContainer>
    );
  }

  return (
    <LaunchInferForm
      createInferParams={resubmitInput ? createInferParams : undefined}
      misPath={publicConfig.MIS_URL ?? "/mis"}
    />
  );
}
