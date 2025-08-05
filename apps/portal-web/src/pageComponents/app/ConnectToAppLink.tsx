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

import { parsePlaceholder } from "@scow/lib-config/build/parse";
import type { AppSession } from "@scow/protos/build/portal/app";
import { Static } from "@sinclair/typebox";
import { App } from "antd";
import { join } from "path";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "src/apis";
import { DisabledA } from "src/components/DisabledA";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { ConnectIcon } from "src/icons/operationIcon";
import { type ConnectToAppSchema } from "src/pages/api/app/connectToApp";
import { Cluster } from "src/utils/cluster";
import { publicConfig } from "src/utils/config";
import { openDesktop } from "src/utils/vnc";

export interface Props {
  cluster: Cluster;
  session: AppSession;
  refreshToken: boolean;
}

const p = prefix("pageComp.app.connectToAppLink.");

export const ConnectTopAppLink: React.FC<Props> = ({
  session, cluster, refreshToken,
}) => {

  const { message } = App.useApp();

  const t = useI18nTranslateToString();

  const replyRef = useRef<Static<typeof ConnectToAppSchema["responses"]["200"]> | undefined>(undefined);

  // 保存是否已经检查到可以连接的状态
  const [isConnected, setIsConnected] = useState<boolean>(false);

  const checkConnectivityPromiseFn = useCallback(async (signal: AbortSignal) => {

    if (!session.host || !session.port) { return false; }

    // 判断是否已经检查为可以连接的状态，如果是，直接返回true不再进行下方检查
    if (isConnected) { return true; }

    if (session.appType?.toLowerCase() === "shadowdesk") {
      return api.checkShadowDeskConnectivity({ query: { id: session.user || "",
        proxyServer: session.proxyServer || "", connectPath: session.connectPath || "" } }, signal)
        .then((x) => x.ok);
    } else {

      // 先通过ConnectToApp获取后端返回的host，port，proxyType
      const response = await api.connectToApp({ body:
        { cluster: cluster.id, sessionId:session.sessionId } }, signal)
        .httpError(404, () => {
          return false;
        })
        .httpError(409, () => {
          return false;
        });

      // 保存获取的 response 信息连接时使用
      replyRef.current = response;

      if (response.type === "web" || response.type === "vnc") {

        // 对于 web或vnc 应用，模拟到端口的http请求
        return await api.checkAppConnectivity({
          query: {
            cluster: cluster.id,
            host: response.host,
            port: response.port,
            appType: response.type,
            proxyType: response.type === "web" ? response.proxyType : undefined,
          } }, signal)
          .then((x) => x.ok);

      // 此检验方法不支持 web 和 vnc 以外类型的应用
      } else {
        message.error(t(p("notConnectableMessage")));
        return false;
      }

    }

  }, [session.host, session.port, cluster.id, isConnected]);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const checkConnectivity = async () => {
      try {
        const checkResult = await checkConnectivityPromiseFn(signal);
        setIsConnected(checkResult);
      } catch {
        setIsConnected(false);
      }
    };

    checkConnectivity();

    return () => {
      controller.abort();
    };
  }, [checkConnectivityPromiseFn, refreshToken, session]);

  const submitForm = (url: string, formData: Record<string, string> | undefined) => {
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
  };

  const onClick = async () => {

    // 如果是web应用直接使用已保存的信息提交表单, 不再发送connectToApp请求
    if (replyRef?.current?.type === "web") {

      const { connect, host, password, port, proxyType, customFormData } = replyRef.current;
      const interpolatedValues = { HOST: host, PASSWORD: password, PORT: port, ...customFormData };
      const path = parsePlaceholder(connect.path, interpolatedValues);
      const pathname = join(publicConfig.BASE_PATH, "/api/proxy", cluster.id, proxyType, host, String(port), path);

      const interpolateValues = (obj: Record<string, string>) => {
        return Object.keys(obj).reduce((prev, curr) => {
          prev[curr] = parsePlaceholder(obj[curr], interpolatedValues);
          return prev;
        }, {});
      };
      const query = connect.query ? interpolateValues(connect.query) : {};
      const url = pathname + "?" + new URLSearchParams(query).toString();
      const formData = connect.formData ? interpolateValues(connect.formData) : undefined;

      if (connect.method === "GET") {
        window.open(url, "_blank");
      } else {
        submitForm(url, formData);
      }

    } else {

      // 如果不是web应用需要重新发起 connectToApp的请求
      const res = await api.connectToApp({ body:
        { cluster: cluster.id, sessionId:session.sessionId } })
        .httpError(404, () => { message.error(t(p("notFoundMessage"))); })
        .httpError(409, () => { message.error(t(p("notConnectableMessage"))); });

      if (res.type === "shadowDesk") {
        // shadowDesk
        const { connect, password, customFormData } = res;
        const interpolatedValues = { PASSWORD: password, ...customFormData };

        const interpolateValues = (obj: Record<string, string>) => {
          return Object.keys(obj).reduce((prev, curr) => {
            prev[curr] = parsePlaceholder(obj[curr], interpolatedValues);
            return prev;
          }, {});
        };
        const formData = connect.formData ? interpolateValues(connect.formData) : undefined;
        const pathname = join(publicConfig.BASE_PATH, connect.path);

        submitForm(pathname, formData);

      } else {

        // vnc 应用需要点击连接时 发送connectToApp请求实时刷新密码
        const { host, port, password } = res;
        // vnc应用一定有密码
        openDesktop(cluster.id, host, port, password ?? "");
      }
    }
  };

  return (
    <DisabledA
      disabled={!isConnected}
      onClick={onClick}
      message={session.appType?.toLowerCase() === "shadowdesk" ? t(p("notReady")) : t(p("portNotOpen"))}
      abledMessage={t(p("connect"))}
    >
      { isConnected ? (
        <ConnectIcon />
      ) : <ConnectIcon disabled />}
    </DisabledA>
  );
};
