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
import "src/styles/globals.css";

import { failEvent } from "@ddadaal/next-typed-api-routes-runtime/lib/client";
import { UiExtensionStore } from "@scow/lib-web/build/extensions/UiExtensionStore";
import { DarkModeProvider } from "@scow/lib-web/build/layouts/darkMode";
import { GlobalStyle } from "@scow/lib-web/build/layouts/globalStyle";
import { useConstant } from "@scow/lib-web/build/utils/hooks";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App as AntdApp, Spin } from "antd";
import type { AppContext, AppProps } from "next/app";
import NextApp from "next/app";
import dynamic from "next/dynamic";
import Head from "next/head";
import { join } from "path";
import { useCallback, useEffect, useRef } from "react";
import { useAsync } from "react-async";
import { createStore, StoreProvider, useStore } from "simstate";
import { api } from "src/apis";
import { ServerErrorPage } from "src/components/errorPages/ServerErrorPage";
import { Provider, useI18n, useI18nTranslate } from "src/i18n";
import en from "src/i18n/en";
import zh_cn from "src/i18n/zh_cn";
import { AntdConfigProvider } from "src/layouts/AntdConfigProvider";
import { BaseLayout } from "src/layouts/BaseLayout";
import { FloatButtons } from "src/layouts/FloatButtons";
import NotificationLayout from "src/layouts/NotifLayout";
import { AppInitialConfig } from "src/pages/api/getAppInitialConfig";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { LoginNodeStore } from "src/stores/LoginNodeStore";
import { UserStore } from "src/stores/UserStore";
import { publicConfig } from "src/utils/config";

const languagesMap = {
  "zh_cn": zh_cn,
  "en": en,
};

const FailEventHandler: React.FC = () => {
  const { message } = AntdApp.useApp();
  const userStore = useStore(UserStore);
  const { publicConfigClusters, setCurrentClusters, setActivatedClusters } = useStore(ClusterInfoStore);
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
          (publicConfigClusters.find((c) => c.id === clusterId)?.name ?? clusterId) : undefined;

        message.error(`${tArgs("pages._app.adapterConnectionError",
          [getI18nConfigCurrentText(clusterName, languageId)]) as string}(${
          e.data.details
        })`);
        return;
      }


      if (e.data?.code === "NO_ACTIVATED_CLUSTERS") {
        message.error(tArgs("pages._app.noActivatedClusters"));
        setCurrentClusters([]);
        setActivatedClusters([]);
        return;
      }

      if (e.data?.code === "NOT_EXIST_IN_ACTIVATED_CLUSTERS") {
        message.error(tArgs("pages._app.notExistInActivatedClusters"));

        const currentActivatedClusterIds = e.data.currentActivatedClusterIds;
        const activatedClusters = publicConfigClusters.filter((x) => currentActivatedClusterIds.includes(x.id));
        setCurrentClusters(activatedClusters);
        setActivatedClusters(activatedClusters);
        return;
      }

      if (e.data?.code === "NO_CLUSTERS") {
        message.error(tArgs("pages._app.noClusters"));
        return;
      }

      // 网络问题或标签休眠期间的定时任务会报错到此处处理
      // 忽略通知接口的错误
      if (e.request?.url?.includes("/api/notification/getUnreadMessages") && e.status === -1) {
        return;
      }

      message.error(tArgs("common.finalError"));
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


function MyAppRoot(appProps: AppProps) {
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
      <MyAppLoader {...appProps} />
    </>
  );
}

function MyAppLoader(appProps: AppProps) {
  const promiseFn = useCallback(async () => {
    return api.getAppInitialConfig({ });
  }, []);

  const { data, isLoading } = useAsync({ promiseFn });

  if (isLoading) {
    return <Spin />;
  }

  if (!data) {
    return <ServerErrorPage />;
  }

  return <MyApp appProps={appProps} extra={data} />;


}

function MyApp({ appProps: { pageProps, Component }, extra }: {
  appProps: AppProps;
  extra: AppInitialConfig;
}) {

  // remembers extra props from first load
  const { current: { userInfo, primaryColor, footerText, loginNodes } } = useRef(extra);

  const userStore = useConstant(() => {
    const store = createStore(UserStore, userInfo);
    return store;
  });

  const clusterInfoStore = useConstant(() => {
    return createStore(ClusterInfoStore,
      extra.clusterConfigs,
      extra.initialCurrentClusters,
      extra.initialPortalRuntimeDesktopEnabled,
      extra.userAssociatedClusterIds,
    );
  });

  const loginNodeStore = useConstant(() => createStore(LoginNodeStore, loginNodes,
    extra.initialLanguage));

  const uiExtensionStore = useConstant(() => createStore(UiExtensionStore, publicConfig.UI_EXTENSION));

  // Use the layout defined at the page level, if available
  return (
    <Provider initialLanguage={{
      id: extra.initialLanguage,
      definitions: languagesMap[extra.initialLanguage],
    }}
    >
      <StoreProvider
        stores={[userStore, clusterInfoStore, loginNodeStore, uiExtensionStore]}
      >
        <DarkModeProvider initial={extra.darkModeCookieValue}>
          <AntdConfigProvider
            primaryColor={primaryColor}
            locale={ extra.initialLanguage}
            color={primaryColor.defaultColor}
          >
            <FloatButtons languageId={ extra.initialLanguage } />
            <GlobalStyle />
            <FailEventHandler />
            <TopProgressBar />
            <BaseLayout
              footerText={footerText}
              versionTag={publicConfig.VERSION_TAG}
              initialLanguage={extra.initialLanguage}
            >
              {publicConfig.NOTIF_ENABLED ? (
                <NotificationLayout interval={300000}>
                  <Component {...pageProps} />
                </NotificationLayout>
              )
                : <Component {...pageProps} />}
            </BaseLayout>
          </AntdConfigProvider>
        </DarkModeProvider>
      </StoreProvider>
    </Provider>
  );
}

MyAppRoot.getInitialProps = async (appContext: AppContext) => {
  return await NextApp.getInitialProps(appContext);
};

export default MyAppRoot;
