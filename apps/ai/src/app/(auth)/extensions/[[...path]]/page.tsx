"use client";

import { ExtensionManifestWithUrl,fetchManifestsWithErrorHandling, UiExtensionStoreData }
  from "@scow/lib-web/build/extensions/UiExtensionStore";
import { Spin } from "antd";
import { use,useCallback, useEffect,useState } from "react";
import { usePublicConfig } from "src/app/(auth)/context";
import { useI18n } from "src/i18n";
import { NotFoundPage } from "src/layouts/error/NotFoundPage";

import { ExtensionPage as LibExtensionPage } from "./ExtensionPage";

export default function Page({ params }: { params: Promise<{ path: string[] }> }) {

  const { path } = use(params);

  const { publicConfig } = usePublicConfig();
  const [uiExtensionData, setUiExtensionData] = useState<UiExtensionStoreData | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const i18n = useI18n();
  const uiExtensionConfig = publicConfig.UI_EXTENSION;

  useEffect(() => {
    fetchUiExtension();
  }, []);

  const fetchUiExtension = useCallback(async () => {
    if (!uiExtensionConfig) {
      setUiExtensionData(undefined);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    let result: UiExtensionStoreData;
    if (Array.isArray(uiExtensionConfig)) {
      const promises = uiExtensionConfig.map((config) =>
        fetchManifestsWithErrorHandling(config.url, config.name),
      );
      const results = await Promise.all(promises);
      result = results.filter(Boolean) as (ExtensionManifestWithUrl & { name: string })[];
    } else {
      const resp = await fetchManifestsWithErrorHandling(uiExtensionConfig.url);
      result = resp;
    }
    setUiExtensionData(result);
    setIsLoading(false);
  }, [uiExtensionConfig]);

  if (isLoading) {
    return (
      <Spin />
    );
  }

  if (!uiExtensionData) {
    return (
      <NotFoundPage />
    );
  }

  return (
    <LibExtensionPage
      path={path}
      uiExtensionConfigData={uiExtensionData}
      currentLanguageId={i18n.currentLanguage.id}
      NotFoundPageComponent={NotFoundPage}
    />
  );
};
