"use client";

import { CodeOutlined, ExperimentOutlined } from "@ant-design/icons";
import { extractPlaceholders, parsePlaceholder } from "@scow/lib-config/build/parse";
import { App, Button, Tooltip } from "antd";
import { join } from "path";
import { useCallback, useEffect } from "react";
import { usePublicConfig } from "src/app/(auth)/context";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { AppName } from "src/models/App";
import { AppSession } from "src/server/trpc/route/jobs/apps";
import { trpc } from "src/utils/trpc";

export interface Props {
  session: AppSession;
  cluster: string;
  appName: AppName;
  refreshToken: boolean;
}

/**
 * 从字段对象中提取所有 {{ KEY }} 占位符，生成用于替换的值映射。
 * 优先使用 baseInterpolatedValues 中的值，也可以扩展支持其他来源。
 */
const buildInterpolatedValues = (
  obj: Record<string, string> | undefined,
  base: Record<string, string>,
): Record<string, string> => {
  if (!obj) return base;
  const placeholderKeys = extractPlaceholders(obj);
  const values: Record<string, string> = { ...base };

  for (const key of placeholderKeys) {
    if (!(key in values)) {
      values[key] = key; // 仅当 base 中没有，才用 key 作为默认值
    }
  }

  return values;
};

const interpolateValues = (
  obj: Record<string, string>,
  valueMap: Record<string, string>,
): Record<string, string> => {
  return Object.entries(obj).reduce<Record<string, string>>((acc, [key, val]) => {
    acc[key] = parsePlaceholder(val, valueMap);
    return acc;
  }, {});
};

interface AppConnectProps {
  method: string;
  path: string;
  query?: Record<string, string>;
  formData?: Record<string, string>;
}

interface BaseConnection {
  host: string;
  port: number;
  password: string;
}

interface WebTypeProps {
  type: "web";
  connect: AppConnectProps;
  proxyType: "relative" | "absolute";
  customFormData?: Record<string, string>;
}

export type ConnectToAppResponse = BaseConnection & WebTypeProps;

export const DevHostConnectLink: React.FC<Props> = ({
  session, cluster, appName, refreshToken,
}) => {
  const t = useI18nTranslateToString();
  const p = prefix("app.devHost.listPage.");
  const { publicConfig: { BASE_PATH } } = usePublicConfig();
  const { message } = App.useApp();

  const { data, refetch } = trpc.jobs.checkDevHostAppConnectivity.useQuery({
    clusterId: cluster, jobId: session.jobId, sessionId: session.sessionId, appName,
  }, {
    enabled: !!session.jobId && session.state === "RUNNING",
  });

  const connectMutation = trpc.jobs.connectToDevHostApp.useMutation({
    onError(e) {
      message.error(t(p("connectAppFailed"), [appName, e.message]));
    },
  });

  useEffect(() => {
    if (session.state === "RUNNING") refetch();
  }, [refreshToken]);

  const handleConnect = useCallback(async () => {
    const reply = await connectMutation.mutateAsync({
      cluster,
      sessionId: session.sessionId,
      appName,
    });

    if (reply.type === "web") {
      const { connect, host, password, port, proxyType } = reply;

      const baseInterpolatedValues = {
        HOST: host,
        PASSWORD: password,
        PORT: String(port),
      };

      // 各自独立的插值上下文
      const queryInterpolatedValues = buildInterpolatedValues(connect.query, baseInterpolatedValues);
      const formInterpolatedValues = buildInterpolatedValues(connect.formData, baseInterpolatedValues);

      const query = connect.query ? interpolateValues(connect.query, queryInterpolatedValues) : {};
      const formData = connect.formData ? interpolateValues(connect.formData, formInterpolatedValues) : undefined;

      const path = parsePlaceholder(connect.path, queryInterpolatedValues);

      const pathname = join(BASE_PATH, "/api/proxy", cluster, proxyType, host, String(port), path);

      const url = pathname + "?" + new URLSearchParams(query).toString();

      if (connect.method === "GET") {
        window.open(url, "_blank");
      } else {
        const form = document.createElement("form");
        form.style.display = "none";
        form.action = url;
        form.method = "POST";
        form.target = "_blank";
        if (formData) {
          Object.keys(formData).forEach((k) => {
            const input = document.createElement("input");
            input.type = "hidden";
            input.name = k;
            input.value = formData[k];
            form.appendChild(input);
          });
        }
        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
      }
    }
  }, [cluster, session.sessionId, BASE_PATH]);

  const isRunning = session.state === "RUNNING";

  const getAppConfig = (appName: AppName) => {
    switch (appName) {
      case AppName.VSCODE:
        return {
          icon: <CodeOutlined />,
          text: t(p("connectVSCode")),
          tooltip: t(p("connectVSCode")),
        };
      case AppName.JUPYTER_LAB:
        return {
          icon: <ExperimentOutlined />,
          text: t(p("connectJupyterLab")),
          tooltip: t(p("connectJupyterLab")),
        };
      default:
        return {
          icon: null,
          text: t(p("connect")),
          tooltip: t(p("connectApp")),
        };
    }
  };

  const appConfig = getAppConfig(appName);

  return (
    <Tooltip title={appConfig.tooltip}>
      <Button
        type="link"
        icon={appConfig.icon}
        size="small"
        disabled={!isRunning || !data?.ok}
        onClick={handleConnect}
        loading={connectMutation.isPending}
      >
        {appConfig.text}
      </Button>
    </Tooltip>
  );
};
