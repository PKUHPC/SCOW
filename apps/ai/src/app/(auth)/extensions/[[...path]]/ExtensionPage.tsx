"use client";

import { getExtensionRouteQuery } from "@scow/lib-web/build/extensions/common";
import { extensionEvents } from "@scow/lib-web/build/extensions/events";
import { ExtensionManifestWithUrl,UiExtensionStoreData } from "@scow/lib-web/build/extensions/UiExtensionStore";
import { joinWithUrl } from "@scow/utils";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useRef } from "react";
import { useUserQuery } from "src/app/auth";
import { Redirect } from "src/components/Redirect";
import { useDarkMode } from "src/layouts/darkMode";
import { Head } from "src/utils/head";
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
  uiExtensionConfigData: UiExtensionStoreData;
  currentLanguageId: string;
  NotFoundPageComponent: React.FC;
  path: string[];
}

export const ExtensionPage: React.FC<Props> = ({
  path,
  uiExtensionConfigData,
  currentLanguageId,
  NotFoundPageComponent,
}) => {

  const { data: useInfo } = useUserQuery();

  const router = useRouter();

  const rest = useSearchParams();

  const pathParts = [...Array.isArray(path) ? path : (path === null || path === undefined) ? [] : [path]];

  let config: ExtensionManifestWithUrl | undefined = undefined;

  if (Array.isArray(uiExtensionConfigData)) {
    const namePart = pathParts.shift();

    if (!namePart) {
      return (
        <NotFoundPageComponent />
      );
    }
    config = uiExtensionConfigData.find((x) => x?.name === namePart);
  } else {
    config = uiExtensionConfigData;
  }

  if (!config) {
    return <NotFoundPageComponent />;
  }

  if (!useInfo?.user?.token) {
    return <Redirect href="/api/auth" />;
  }

  const [title, setTitle] = React.useState(config?.name ?? "Extension");

  const { dark } = useDarkMode();

  const extensionQuery = getExtensionRouteQuery(dark, currentLanguageId, useInfo.user?.token);

  const query = new URLSearchParams({
    ...rest ? Object.fromEntries(rest.entries()) : {},
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
      <Head title={title} />
      <FrameContainer>
        <IFrame
          ref={ref}
          src={url}
        />
      </FrameContainer>
    </>
  );

};

