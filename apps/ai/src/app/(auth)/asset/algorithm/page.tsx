"use client";

import { Tabs, type TabsProps } from "antd";
import { AlgorithmTable } from "src/app/(auth)/asset/algorithm/AlgorithmTable";
import { usePublicConfig } from "src/app/(auth)/context";
import { AssetContainer } from "src/components/AssetContainer";
import { useI18nTranslateToString } from "src/i18n";
import { useDocumentTitle } from "src/utils/head";

export default function Page() {
  const t = useI18nTranslateToString();

  const { publicConfig } = usePublicConfig();
  useDocumentTitle(t("app.algorithm.title"));

  const items: TabsProps["items"] = [
    {
      key: "1",
      label: t("app.algorithm.private"),
      children: (
        <div>
          <AlgorithmTable isPublic={false} clusters={publicConfig.CLUSTERS} />
        </div>
      ),
    },
    {
      key: "2",
      label: t("app.algorithm.public"),
      children: (
        <div>
          <AlgorithmTable isPublic={true} clusters={publicConfig.CLUSTERS} />
        </div>
      ),
    },
  ];

  return (
    <AssetContainer>
      <Tabs defaultActiveKey="1" items={items} />
    </AssetContainer>
  );
}
