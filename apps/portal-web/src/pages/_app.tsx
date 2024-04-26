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

import "nprogress/nprogress.css";
import "antd/dist/reset.css";

import { failEvent } from "@ddadaal/next-typed-api-routes-runtime/lib/client";
import { UiExtensionStore } from "@scow/lib-web/build/extensions/UiExtensionStore";
import { DarkModeCookie, DarkModeProvider, getDarkModeCookieValue } from "@scow/lib-web/build/layouts/darkMode";
import { GlobalStyle } from "@scow/lib-web/build/layouts/globalStyle";
import { getHostname } from "@scow/lib-web/build/utils/getHostname";
import { useConstant } from "@scow/lib-web/build/utils/hooks";
import { isServer } from "@scow/lib-web/build/utils/isServer";
import { formatOnlineClusters } from "@scow/lib-web/build/utils/misCommon/onlineClusters";
import { getCurrentLanguageId, getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App as AntdApp } from "antd";
import type { AppContext, AppProps } from "next/app";
import NextApp from "next/app";
import dynamic from "next/dynamic";
import Head from "next/head";
import { join } from "path";
import { useEffect, useRef } from "react";
import { createStore, StoreProvider, useStore } from "simstate";
import { api } from "src/apis";
import { USE_MOCK } from "src/apis/useMock";
import { getTokenFromCookie } from "src/auth/cookie";
import { Provider, useI18n, useI18nTranslate } from "src/i18n";
import en from "src/i18n/en";
import zh_cn from "src/i18n/zh_cn";
import { AntdConfigProvider } from "src/layouts/AntdConfigProvider";
import { BaseLayout } from "src/layouts/BaseLayout";
import { FloatButtons } from "src/layouts/FloatButtons";
import { CurrentClustersStore } from "src/stores/CurrentClustersStore";
import { DefaultClusterStore } from "src/stores/DefaultClusterStore";
import { LoginNodeStore } from "src/stores/LoginNodeStore";
import {
  User, UserStore,
} from "src/stores/UserStore";
import { Cluster, LoginNode, publicConfig, runtimeConfig } from "src/utils/config";

const languagesMap = {
  "zh_cn": zh_cn,
  "en": en,
};

const FailEventHandler: React.FC = () => {
  const { message } = AntdApp.useApp();
  const userStore = useStore(UserStore);
  const currentClusterStore = useStore(CurrentClustersStore);
  const tArgs = useI18nTranslate();
  const languageId = useI18n().currentLanguage.id;

  // 登出过程需要调用的几个方法（logout, useState等）都是immutable的
  // 所以不需要每次userStore变化时来重新注册handler
  useEffect(() => {
    failEvent.register((e) => {
      if (e.status === 401) {
        userStore.logout();
        return;
      }

      const regex = /exceeds max length/;
      // 如果终端登录欢迎语过长会报错：Packet length xxxx exceeds max length of 262144
      if (regex.test(e.data?.message)) {
        message.error(tArgs("pages._app.textExceedsLength"));
        return;
      }

      if (e.data?.code === "SSH_ERROR") {
        message.error(tArgs("pages._app.sshError"));
        return;
      }

      if (e.data?.code === "SFTP_ERROR") {
        message.error(e.data?.details.length > 150 ? e.data?.details.substring(0, 150) + "..." :
          e.data?.details || tArgs("pages._app.sftpError"));
        return;
      }

      if (e.data?.code === "ADAPTER_CALL_ON_ONE_ERROR") {

        const clusterId = e.data.clusterErrorsArray[0].clusterId;
        const clusterName = clusterId ?
          (publicConfig.CLUSTERS.find((c) => c.id === clusterId)?.name ?? clusterId) : undefined;

        message.error(`${tArgs("pages._app.adapterConnectionError",
          [getI18nConfigCurrentText(clusterName, languageId)])}(${
          e.data.details
        })`);
        return;
      }


      if (e.data?.code === "NO_ONLINE_CLUSTERS") {
        message.error(tArgs("pages._app.noOnlineClusters"));
        if (currentClusterStore.setCurrentClusters) currentClusterStore.setCurrentClusters([]);
        return;
      }

      if (e.data?.code === "NOT_EXIST_IN_ONLINE_CLUSTERS") {
        message.error(tArgs("pages._app.notExistInOnlineClusters"));

        const currentOnlineClusterIds = e.data.currentOnlineClusterIds;
        const onlineClusters = publicConfig.CLUSTERS.map((x) => currentOnlineClusterIds.includes(x.id));
        if (currentClusterStore.setCurrentClusters) currentClusterStore.setCurrentClusters(onlineClusters);
        // 刷新当前页面
        // window.location.reload();
        return;
      }

      message.error(`${tArgs("pages._app.otherError")}(${e.status}, ${e.data?.code}))`);
    });
  }, []);

  return <></>;
};


const TopProgressBar = dynamic(
  () => {
    return import("src/components/TopProgressBar");
  },
  { ssr: false },
);

interface ExtraProps {
  userInfo: User | undefined;
  primaryColor: string;
  footerText: string;
  loginNodes: Record<string, LoginNode[]>;
  darkModeCookieValue: DarkModeCookie | undefined;
  initialLanguage: string;
  initialCurrentClusters: Cluster[];
}

type Props = AppProps & { extra: ExtraProps };

function MyApp({ Component, pageProps, extra }: Props) {

  // remembers extra props from first load
  const { current: { userInfo, primaryColor, footerText, loginNodes } } = useRef(extra);

  const userStore = useConstant(() => {
    const store = createStore(UserStore, userInfo);
    return store;
  });

  const currentClustersStore = useConstant(() => {
    return createStore(CurrentClustersStore, extra.initialCurrentClusters);
  });

  const initialDefaultClusterId = publicConfig.CLUSTER_SORTED_ID_LIST.find((x) => {
    return extra.initialCurrentClusters.find((c) => c.id === x);
  });
  const defaultClusterStore
   = useConstant(() => createStore(DefaultClusterStore, initialDefaultClusterId, extra.initialCurrentClusters));

  const loginNodeStore = useConstant(() => createStore(LoginNodeStore, loginNodes,
    extra.initialLanguage));

  const uiExtensionStore = useConstant(() => createStore(UiExtensionStore, publicConfig.UI_EXTENSION));

  // Use the layout defined at the page level, if available
  return (
    <>
      <Head>
        <meta name="format-detection" content="telephone=no" />
        <link href={join(publicConfig.BASE_PATH, "/manifest.json")} rel="manifest" id="manifest" />
        <link
          rel="icon"
          type="image/x-icon"
          href={join(publicConfig.BASE_PATH, "/api/icon?type=favicon")}
        ></link>
        <script
          id="__CONFIG__"
          dangerouslySetInnerHTML={{
            __html: `
              window.__CONFIG__ = ${
    JSON.stringify({
      BASE_PATH: publicConfig.BASE_PATH === "/" ? "" : publicConfig.BASE_PATH,
    })};
            `,
          }}
        />
      </Head>
      <Provider initialLanguage={{
        id: extra.initialLanguage,
        definitions: languagesMap[extra.initialLanguage],
      }}
      >
        <StoreProvider
          stores={[userStore, currentClustersStore, defaultClusterStore, loginNodeStore, uiExtensionStore]}
        >
          <DarkModeProvider initial={extra.darkModeCookieValue}>
            <AntdConfigProvider color={primaryColor} locale={ extra.initialLanguage}>
              <FloatButtons languageId={ extra.initialLanguage } />
              <GlobalStyle />
              <FailEventHandler />
              <TopProgressBar />
              <BaseLayout
                footerText={footerText}
                versionTag={publicConfig.VERSION_TAG}
                initialLanguage={extra.initialLanguage}
              >
                <Component {...pageProps} />
              </BaseLayout>
            </AntdConfigProvider>
          </DarkModeProvider>
        </StoreProvider>
      </Provider>
    </>
  );
}

MyApp.getInitialProps = async (appContext: AppContext) => {

  const extra: ExtraProps = {
    userInfo: undefined,
    footerText: "",
    primaryColor: "",
    darkModeCookieValue: getDarkModeCookieValue(appContext.ctx.req),
    loginNodes: {},
    initialLanguage: "",
    initialCurrentClusters: [],
  };

  // This is called on server on first load, and on client on every page transition
  // But we don't need to fetch token info on every page transition
  // so only execute on server
  // Also, validateToken relies on redis, which is not available in client bundle
  if (isServer()) {

    const token = USE_MOCK ? "123" : getTokenFromCookie(appContext.ctx);
    if (token) {
    // Why not directly call validateToken but create an api?
    // Because this method will (in next.js's perspective) be called both in client and server,
    // so next.js will import validateToken into the client bundle
    // validateToken depends on ioredis, which cannot be brought into frontend.
    // dynamic import also doesn't work.
      const userInfo = await api.validateToken({ query: { token } }).catch(() => undefined);

      if (userInfo) {
        extra.userInfo = {
          ...userInfo,
          token: token,
        };
      }

    }

    const hostname = getHostname(appContext.ctx.req);

    extra.primaryColor = (hostname && runtimeConfig.UI_CONFIG?.primaryColor?.hostnameMap?.[hostname])
      ?? runtimeConfig.UI_CONFIG?.primaryColor?.defaultColor ?? runtimeConfig.DEFAULT_PRIMARY_COLOR;
    extra.footerText = (hostname && runtimeConfig.UI_CONFIG?.footer?.hostnameMap?.[hostname])
      ?? (hostname && runtimeConfig.UI_CONFIG?.footer?.hostnameTextMap?.[hostname])
      ?? runtimeConfig.UI_CONFIG?.footer?.defaultText ?? "";

    // TODO:确认是否为数据逻辑
    extra.loginNodes = publicConfig.CLUSTER_SORTED_ID_LIST.reduce((acc, cluster) => {
      acc[cluster] = runtimeConfig.CLUSTERS_CONFIG[cluster].loginNodes;
      return acc;
    }, {});

    // 从Cookies或header中获取语言id
    extra.initialLanguage = getCurrentLanguageId(appContext.ctx.req, publicConfig.SYSTEM_LANGUAGE_CONFIG);

    // get current initial online clusters
    const currentClusters = await api.getClustersDatabaseInfo({}).then((x) => x, () => undefined);
    const initialOnlineClusters =
    formatOnlineClusters({
      clustersFromDb: currentClusters?.results,
      configClusters: publicConfig.CLUSTERS,
      misDeployed: publicConfig.MIS_DEPLOYED });
    extra.initialCurrentClusters = initialOnlineClusters.onlineClusters ?? [];

  }

  const appProps = await NextApp.getInitialProps(appContext);

  // getAvailable

  return { ...appProps, extra } as Props;
};

export default MyApp;
