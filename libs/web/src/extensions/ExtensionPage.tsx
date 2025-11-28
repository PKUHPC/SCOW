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

import { joinWithUrl } from "@scow/utils";
import { useRouter } from "next/router";
import React, { useEffect, useRef } from "react";
import { Head } from "src/components/head";
import { Redirect } from "src/components/Redirect";
import { getExtensionRouteQuery } from "src/extensions/common";
import { extensionEvents } from "src/extensions/events";
import { ExtensionManifestWithUrl, UiExtensionStoreData } from "src/extensions/UiExtensionStore";
import { UserInfo } from "src/layouts/base/types";
import { useDarkMode } from "src/layouts/darkMode";
import { queryToArray } from "src/utils/querystring";
import { styled } from "styled-components";

const FrameContainer = styled.div`
  display: flex;
  width: 100%;
  height: 100%;
  min-height: calc(100vh - 123px);
`;

// min-height的高度通过计算全屏高度去掉footer及header及外层padding得来
const IFrame = styled.iframe`
  display: flex;
  border: none;
  flex: 1;
  min-height: calc(100vh - 123px);
`;

interface Props {
  user: UserInfo | undefined;

  uiExtensionStoreConfig: UiExtensionStoreData;

  currentLanguageId: string;

  NotFoundPageComponent: React.FC;

  titleTag?: string;
}

export const ExtensionPage: React.FC<Props> = ({
  user,
  uiExtensionStoreConfig,
  currentLanguageId,
  NotFoundPageComponent,
  titleTag,
}) => {

  const router = useRouter();

  const { path, ...rest } = router.query;

  const pathParts = [...queryToArray(path)];

  let config: ExtensionManifestWithUrl | undefined = undefined;

  if (Array.isArray(uiExtensionStoreConfig)) {
    const namePart = pathParts.shift();

    if (!namePart) {
      return (
        <NotFoundPageComponent />
      );
    }
    config = uiExtensionStoreConfig.find((x) => x?.name === namePart);
  } else {
    config = uiExtensionStoreConfig;
  }

  if (!config) {
    return <NotFoundPageComponent />;
  }

  if (!user?.token) {
    return <Redirect url="/api/auth" />;
  }


  const [title, setTitle] = React.useState(config?.name ?? "Extension");

  const darkMode = useDarkMode();

  const extensionQuery = getExtensionRouteQuery(darkMode.dark, currentLanguageId, user?.token);

  const query = new URLSearchParams({
    ...Object.fromEntries(Object.entries(rest).filter(([_, val]) => typeof val === "string")),
    ...extensionQuery,
  });

  const url = joinWithUrl(config.url, "extensions", ...pathParts)
    + "?" + query.toString();

  const ref = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const messageHandler = (e: MessageEvent<any>) => {

      if (!ref.current) {
        return;
      }

      const event = extensionEvents.safeParse(e.data);

      if (!event.success) {
        console.log("SCOW received an invalid event from extension page. event: %s", JSON.stringify(e.data));
        return;
      }

      const data = event.data;

      if (data.type === "scow.extensionPageHeightChanged") {
        ref.current.style.height = data.payload.height + "px";
      } else if (data.type === "scow.extensionPageTitleChanged") {
        setTitle(data.payload.title);
      } else if (data.type === "scow.logout") {
        router.push("/api/auth");
      }
    };
    window.addEventListener("message", messageHandler, false);

    return () => {
      window.removeEventListener("message", messageHandler, false);
    };
  }, []);

  return (
    <>
      <Head title={title} titleTag={titleTag} />
      <FrameContainer>
        <IFrame
          ref={ref}
          src={url}
        />
      </FrameContainer>
    </>
  );

};

