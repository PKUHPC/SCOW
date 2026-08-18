import { Result, Spin } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useParams } from "react-router-dom";
import { useMetadataQuery } from "src/api/metadata";
import { useUiConfigQuery } from "src/api/uiConfig";
import { getScowPath } from "src/config/runtime";
import { useLogoutMutation } from "src/features/profile";
import { getExtensionPageMatch, joinExtensionUrl } from "src/features/uiExtension/paths";
import { uiExtensionKeys, useUiExtensionsQuery } from "src/features/uiExtension/queries";
import { extensionEventSchema } from "src/features/uiExtension/schemas";
import { useQueryClient } from "@tanstack/react-query";
import { styled } from "styled-components";

const FrameContainer = styled.div`
  display: flex;
  width: 100%;
  min-height: calc(100dvh - 120px);
`;

const ExtensionFrame = styled.iframe`
  display: flex;
  flex: 1;
  width: 100%;
  min-height: calc(100dvh - 120px);
  border: 0;
`;

export function ExtensionPage() {
  const { i18n, t } = useTranslation("common");
  const metadataQuery = useMetadataQuery();
  const uiConfigQuery = useUiConfigQuery(metadataQuery.data);
  const extensionsQuery = useUiExtensionsQuery(metadataQuery.data);
  const params = useParams();
  const location = useLocation();
  const queryClient = useQueryClient();
  const logoutMutation = useLogoutMutation();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const match = getExtensionPageMatch(extensionsQuery.data ?? [], params["*"]);
  const extension = match?.extension;
  const token = uiConfigQuery.data?.userToken;
  const [title, setTitle] = useState("Extension");

  useEffect(() => {
    setTitle(extension?.name ?? "Extension");
  }, [extension]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = uiConfigQuery.data?.titleTag ? `${title} - ${uiConfigQuery.data.titleTag}` : title;
    return () => {
      document.title = previousTitle;
    };
  }, [title, uiConfigQuery.data?.titleTag]);

  useEffect(() => {
    if (extension && uiConfigQuery.isSuccess && !token) window.location.assign(getScowPath("/api/auth"));
  }, [extension, token, uiConfigQuery.isSuccess]);

  const frameUrl = useMemo(() => {
    if (!match || !token) return undefined;
    const query = new URLSearchParams(location.search);
    query.set("scowUserToken", token);
    query.set("scowDark", uiConfigQuery.data?.darkMode ? "true" : "false");
    query.set("scowLangId", i18n.language);
    const url = joinExtensionUrl(match.extension.url, "extensions", ...match.extensionPath);
    return `${url}?${query.toString()}`;
  }, [i18n.language, location.search, match, token, uiConfigQuery.data?.darkMode]);

  useEffect(() => {
    if (!extension) return;
    const extensionOrigin = new URL(extension.url).origin;
    const messageHandler = (event: MessageEvent<unknown>) => {
      if (event.source !== frameRef.current?.contentWindow || event.origin !== extensionOrigin) return;
      const parsed = extensionEventSchema.safeParse(event.data);
      if (!parsed.success) {
        console.warn("SCOW received an invalid event from extension page", event.data);
        return;
      }
      const extensionEvent = parsed.data;
      if (extensionEvent.type === "scow.extensionPageHeightChanged") {
        frameRef.current.style.height = `${Math.max(0, extensionEvent.payload.height)}px`;
      } else if (extensionEvent.type === "scow.extensionPageTitleChanged") {
        setTitle(extensionEvent.payload.title);
      } else if (extensionEvent.type === "scow.reloadNavbarLink") {
        void queryClient.invalidateQueries({ queryKey: uiExtensionKeys.navbarLinks() });
      } else if (extensionEvent.type === "scow.reloadNavigations") {
        void queryClient.invalidateQueries({ queryKey: uiExtensionKeys.navigations() });
      } else if (extensionEvent.type === "scow.logout") {
        logoutMutation.mutate(undefined, {
          onSettled: () => window.location.assign(getScowPath("/api/auth")),
        });
      }
    };
    window.addEventListener("message", messageHandler);
    return () => window.removeEventListener("message", messageHandler);
  }, [extension, logoutMutation, queryClient]);

  if (metadataQuery.isLoading || extensionsQuery.isLoading || uiConfigQuery.isLoading) {
    return <Spin />;
  }
  if (uiConfigQuery.isError) {
    return <Result status="error" title={t("bootstrap.sessionFailed", "登录状态检查失败")} />;
  }
  if (extension && !token) return <Spin />;
  if (!match || !frameUrl) {
    return <Result status="404" title={t("notFound.title", "页面不存在")} />;
  }

  return (
    <FrameContainer>
      <ExtensionFrame ref={frameRef} src={frameUrl} title={title} />
    </FrameContainer>
  );
}
