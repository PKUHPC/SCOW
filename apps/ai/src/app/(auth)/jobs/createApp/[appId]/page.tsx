"use client";

import { LoadingOutlined } from "@ant-design/icons";
import { App } from "antd";
import { useSearchParams } from "next/navigation";
import { use, useEffect, useMemo } from "react";
import { usePublicConfig } from "src/app/(auth)/context";
import { FullWidthContainer } from "src/app/(auth)/jobs/common";
import { useI18nTranslateToString } from "src/i18n";
import { useDocumentTitle } from "src/utils/head";
import { trpc } from "src/utils/trpc";

import { LaunchAppForm } from "./LaunchAppForm";

export default function Page({ params }: { params: Promise<{ appId: string }> }) {
  const { appId } = use(params);
  const t = useI18nTranslateToString();
  const searchParams = useSearchParams();
  const { message } = App.useApp();

  useDocumentTitle(t("app.jobs.launchAppForm.title"));

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

  // 展示应用时使用的参数
  const appName = queryParams.appName ?? "";
  const appLogoPath = queryParams.logoPath ?? "";
  const appComment = queryParams.comment ?? "";
  const appImage = queryParams.image ?? "";
  const startCommand = queryParams.startCommand ?? "";

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
    data: createAppParams,
    error: getCreateAppParamsError,
    isLoading: isCreateAppParamsLoading,
  } = trpc.jobs.getCreateAppParams.useQuery(resubmitInput ?? emptyParams, {
    enabled: Boolean(resubmitInput),
    retry: false,
    meta: {
      silent: true,
    },
  });

  useEffect(() => {
    if (!getCreateAppParamsError) {
      return;
    }

    message.error(`${t("app.jobs.launchAppForm.getCreateAppParamsFailed")}: ${getCreateAppParamsError.message}`);
  }, [getCreateAppParamsError, message, t]);

  if (resubmitInput && isCreateAppParamsLoading) {
    return (
      <FullWidthContainer>
        <LoadingOutlined />
      </FullWidthContainer>
    );
  }

  return (
    <LaunchAppForm
      publicPath={publicConfig.PUBLIC_PATH}
      misPath={publicConfig.MIS_URL ?? "/mis"}
      appName={appName || createAppParams?.appName}
      appId={appId}
      appLogoPath={appLogoPath}
      appComment={appComment}
      appImage={appImage}
      appStartCommand={startCommand}
      createAppParams={resubmitInput ? createAppParams : undefined}
      clusterId={clusterId}
    />
  );
}
