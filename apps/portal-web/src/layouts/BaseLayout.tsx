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

import { DatabaseOutlined } from "@ant-design/icons";
import { BaseLayout as LibBaseLayout } from "@scow/lib-web/build/layouts/base/BaseLayout";
import { JumpToAnotherLink } from "@scow/lib-web/build/layouts/base/header/components";
import { setCookie } from "nookies";
import { PropsWithChildren, useEffect, useMemo } from "react";
import { useStore } from "simstate";
import { LanguageSwitcher } from "src/components/LanguageSwitcher";
import { useI18n, useI18nTranslateToString } from "src/i18n";
import { userRoutes } from "src/layouts/routes";
import { DefaultClusterStore } from "src/stores/DefaultClusterStore";
import { LoginNodeStore } from "src/stores/LoginNodeStore";
import { UserStore } from "src/stores/UserStore";
import { publicConfig } from "src/utils/config";

interface Props {
  footerText: string;
  versionTag: string | undefined;
  initialLanguage: string;
}

export const BaseLayout = ({ footerText, versionTag, initialLanguage, children }: PropsWithChildren<Props>) => {

  const userStore = useStore(UserStore);
  const { loginNodes } = useStore(LoginNodeStore);
  const { defaultCluster, setDefaultCluster, removeDefaultCluster } = useStore(DefaultClusterStore);

  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;

  const systemLanguageConfig = publicConfig.SYSTEM_LANGUAGE_CONFIG;
  useEffect(() => {
    // 如果不使用国际化或者不跟随系统自动判断语言
    // 则删除cookies中的语言信息
    if (!systemLanguageConfig.isUsingI18n || !systemLanguageConfig.autoDetect) {
      setCookie(null, "language", "", {
        maxAge: -1,
        path: "/",
      });
    };

  }, [systemLanguageConfig.isUsingI18n, systemLanguageConfig.autoDetect]);

  const routes = useMemo(() => userRoutes(
    userStore.user, defaultCluster, loginNodes, setDefaultCluster,
  ), [userStore.user, defaultCluster, setDefaultCluster]);

  const logout = () => {
    removeDefaultCluster();
    userStore.logout();
  };

  return (
    <LibBaseLayout
      logout={logout}
      user={userStore.user}
      routes={routes}
      footerText={footerText}
      versionTag={versionTag}
      basePath={publicConfig.BASE_PATH}
      userLinks={publicConfig.USER_LINKS}
      languageId={languageId}
      headerRightContent={(
        <>
          <JumpToAnotherLink
            user={userStore.user}
            icon={<DatabaseOutlined style={{ paddingRight: 2 }} />}
            link={publicConfig.MIS_URL}
            linkText={t("baseLayout.linkText")}
          />
          {
            systemLanguageConfig.isUsingI18n ? (
              <LanguageSwitcher initialLanguage={initialLanguage} />
            ) : undefined
          }
        </>
      )}
    >
      {children}
    </LibBaseLayout>
  );
};
