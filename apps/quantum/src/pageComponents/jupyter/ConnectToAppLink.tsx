"use client";

import { parsePlaceholder } from "@scow/lib-config/build/parse";
import { App } from "antd";
import { join } from "path";
import { useEffect } from "react";
import { DisabledA } from "src/components/DisabledA";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { AppSession } from "src/server/trpc/route/jobs/apps";
import { trpc } from "src/utils/trpc";

export interface Props {
  session: AppSession;
  cluster: string;
  refreshToken: boolean;
}

export const ConnectTopAppLink: React.FC<Props> = ({
  session, cluster, refreshToken,
}) => {
  const t = useI18nTranslateToString();
  const p = prefix("pageComp.appSessionTable.connectToAppLink.");

  const { message } = App.useApp();

  const { data, refetch } = trpc.jobs.checkAppConnectivity.useQuery({ clusterId: cluster, jobId: session.jobId }, {
    enabled: !!session.jobId,
  });

  const connectMutation = trpc.jobs.connectToApp.useMutation(
    {
      onError(e) {
        message.error(`connectFailed: ${e.message}`);
      },
    },
  );

  useEffect(() => {
    refetch();
  }, [refreshToken]);


  const onClick = async () => {

    const reply = await connectMutation.mutateAsync({
      cluster,
      sessionId:session.sessionId,
    });

    if (reply.type === "web") {
      const { connect, host, password, port, proxyType } = reply;
      const interpolatedValues = { HOST: host, PASSWORD: password, PORT: port };
      const path = parsePlaceholder(connect.path, interpolatedValues);

      const interpolateValues = (obj: Record<string, string>): Record<string, string> => {
        return Object.keys(obj).reduce<Record<string, string>>((prev, curr) => {
          prev[curr] = parsePlaceholder(obj[curr], interpolatedValues);
          return prev;
        }, {});
      };

      const query = connect.query ? interpolateValues(connect.query) : {};
      const formData = connect.formData ? interpolateValues(connect.formData) : undefined;

      const pathname = join("/api/proxy", cluster, proxyType, host, String(port), path); // BASE_PATH后面改成portal的

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

    return;

  };

  return (
    <DisabledA disabled={!data} onClick={onClick} message={t(p("notReady"))}>{t(p("connect"))}</DisabledA>
  );
};
